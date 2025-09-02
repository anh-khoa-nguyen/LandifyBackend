// netlify/functions/sync-remote-config.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Khởi tạo Firebase Admin một cách an toàn ---

// Hàm helper để giải mã Base64 và parse JSON
function getServiceAccount() {
  const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64Key) {
    throw new Error('Biến môi trường FIREBASE_SERVICE_ACCOUNT_BASE64 chưa được thiết lập.');
  }
  const decodedKey = Buffer.from(base64Key, 'base64').toString('utf-8');
  return JSON.parse(decodedKey);
}

// Chỉ khởi tạo app một lần duy nhất (quan trọng cho môi trường serverless)
if (!admin.apps.length) {
  try {
    const serviceAccount = getServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error('Firebase Admin Initialization Error', e);
  }
}

const remoteConfig = admin.remoteConfig();

// --- Hàm chính của Netlify Function ---

exports.handler = async (event) => {
  // (Tùy chọn) Thêm một lớp bảo mật đơn giản: chỉ chạy khi có secret key
  const secretKey = process.env.SYNC_SECRET_KEY;
  const requestKey = event.headers['x-sync-secret'];
  if (secretKey && requestKey !== secretKey) {
    return {
      statusCode: 401,
      body: JSON.stringify({ ok: false, error: 'Unauthorized' })
    };
  }

  try {
    console.log('Bắt đầu quá trình đồng bộ Remote Config...');

    // 1. Đọc dữ liệu cấu hình từ các file JSON
    const propertyTypesPath = path.resolve(__dirname, '../../config/home_property_types.json');
    const featuresPath = path.resolve(__dirname, '../../config/home_features.json');
    
    const propertyTypesRaw = fs.readFileSync(propertyTypesPath, 'utf8');
    const featuresRaw = fs.readFileSync(featuresPath, 'utf8');

    const propertyTypesData = JSON.parse(propertyTypesRaw);
    const featuresData = JSON.parse(featuresRaw);
    console.log(`Đã đọc ${propertyTypesData.length} loại hình BĐS và ${featuresData.length} chức năng.`);

    // 2. Lấy template hiện tại từ Firebase
    const template = await remoteConfig.getTemplate();
    template.parameters = template.parameters || {};
    console.log(`Đã lấy template phiên bản ETag: ${template.etag}`);

    // 3. Cập nhật các tham số trong template
    // Giá trị phải là một chuỗi JSON
    template.parameters['home_property_types'] = {
      defaultValue: { value: JSON.stringify(propertyTypesData) }
    };
    template.parameters['home_features'] = {
      defaultValue: { value: JSON.stringify(featuresData) }
    };
    console.log('Đã cập nhật các tham số trong template.');

    // 4. Validate template
    await remoteConfig.validateTemplate(template);
    console.log('Template hợp lệ.');

    // 5. Publish template mới
    const publishedTemplate = await remoteConfig.publishTemplate(template);
    console.log(`Publish thành công. Phiên bản mới: ${publishedTemplate.version.versionNumber}`);

    // 6. Trả về kết quả thành công
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        message: 'Đồng bộ Remote Config thành công!',
        version: publishedTemplate.version.versionNumber,
        etag: publishedTemplate.etag,
      })
    };

  } catch (err) {
    console.error('Lỗi trong quá trình đồng bộ:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err.message || 'Lỗi không xác định.'
      })
    };
  }
};