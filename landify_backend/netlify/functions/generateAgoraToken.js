// netlify/functions/generateAgoraToken.js

// Import thư viện của Agora
const { RtcTokenBuilder, RtcRole } = require('agora-token');

// Hàm xử lý chính của Netlify Function
exports.handler = async (event, context) => {
  // --- Headers để cho phép CORS (Cực kỳ quan trọng!) ---
  // Cho phép ứng dụng Flutter của bạn (chạy từ bất kỳ đâu) có thể gọi đến function này
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Netlify thực hiện một "preflight" request với phương thức OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: 'This was a preflight call!',
    };
  }

  // --- Lấy thông tin bí mật từ biến môi trường của Netlify ---
  // Khi ở lokal, chúng ta sẽ dùng file .env. Khi triển khai, chúng ta sẽ thiết lập trên web.
  const APP_ID = process.env.AGORA_APP_ID;
  const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

  // --- Lấy dữ liệu được gửi từ ứng dụng Flutter ---
  const body = JSON.parse(event.body);
  const channelName = body.channelName;
  const uid = body.uid; // UID của người dùng yêu cầu token

  // --- Kiểm tra dữ liệu đầu vào ---
  if (!channelName || !uid) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'channelName and uid are required' }),
    };
  }
  if (!APP_ID || !APP_CERTIFICATE) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Agora credentials not configured on server' }),
    };
  }

  // --- Tạo Token ---
  const role = RtcRole.PUBLISHER;
  const expirationTimeInSeconds = 3600; // Token có hiệu lực trong 1 giờ
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  // Tạo token với UID là số nguyên. Agora yêu cầu UID là số.
  const userAccount = uid.toString(); // Chuyển uid (có thể là string) sang string
  const token = RtcTokenBuilder.buildTokenWithUserAccount(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    userAccount, // Dùng user account là string
    role,
    privilegeExpiredTs
  );

  console.log(`Token generated for channel ${channelName} and user ${userAccount}`);

  // --- Trả token về cho ứng dụng Flutter ---
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ token: token }),
  };
};