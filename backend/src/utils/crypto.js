const crypto = require('crypto');

/**
 * 生成 API Key
 * 格式: api_live_ + 32位随机十六进制字符
 * @returns {string} API Key
 */
function generateApiKey() {
    const randomBytes = crypto.randomBytes(16);
    const randomHex = randomBytes.toString('hex');
    return `api_live_${randomHex}`;
}

/**
 * 生成 Secret Key
 * 64位随机十六进制字符
 * @returns {string} Secret Key
 */
function generateSecretKey() {
    const randomBytes = crypto.randomBytes(32);
    return randomBytes.toString('hex');
}

/**
 * 生成 HMAC-SHA256 签名
 * @param {string} method - HTTP方法 (GET, POST, etc.)
 * @param {string} path - 请求路径
 * @param {number} timestamp - 时间戳（毫秒）
 * @param {string} deviceId - 设备ID
 * @param {string} userId - 用户ID
 * @param {string} body - 请求体（JSON字符串）
 * @param {string} secretKey - 密钥
 * @returns {string} Base64编码的签名
 */
function generateSignature(method, path, timestamp, deviceId, userId, body, secretKey) {
    // 构建签名原文
    const message = `${method}\n${path}\n${timestamp}\n${deviceId}\n${userId}\n${body}`;

    // 使用 HMAC-SHA256 生成签名
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(message);

    // 返回 Base64 编码的签名
    return hmac.digest('base64');
}

/**
 * 验证签名是否匹配
 * @param {string} signature - 客户端提供的签名
 * @param {string} expectedSignature - 服务端计算的签名
 * @returns {boolean} 是否匹配
 */
function verifySignature(signature, expectedSignature) {
    // 使用时间安全的比较方法，防止时序攻击
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'base64'),
            Buffer.from(expectedSignature, 'base64')
        );
    } catch (error) {
        // 如果长度不同或格式错误，返回 false
        return false;
    }
}

/**
 * 验证 UUID 格式
 * @param {string} uuid - UUID字符串
 * @returns {boolean} 是否为有效的UUID
 */
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * 验证用户ID格式（UUID无横线）
 * @param {string} userId - 用户ID字符串
 * @returns {boolean} 是否为有效的用户ID
 */
function isValidUserId(userId) {
    const userIdRegex = /^[0-9a-f]{32}$/i;
    return userIdRegex.test(userId);
}

/**
 * 生成事件ID
 * 格式: evt_ + 时间戳 + 随机字符串
 * @returns {string} 事件ID
 */
function generateEventId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `evt_${timestamp}_${random}`;
}

module.exports = {
    generateApiKey,
    generateSecretKey,
    generateSignature,
    verifySignature,
    isValidUUID,
    isValidUserId,
    generateEventId,
};
