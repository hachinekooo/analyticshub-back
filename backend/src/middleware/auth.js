const { dbManager } = require('../config/database');
const { projectManager } = require('../config/projects');
const { generateSignature, verifySignature } = require('../utils/crypto');

/**
 * 认证中间件（支持多项目）
 * 验证请求的 API Key 和 HMAC 签名
 * 
 * 需要的请求头:
 * - X-Project-ID: 项目ID（可选，默认为'default'）
 * - X-API-Key: API密钥
 * - X-Device-ID: 设备ID
 * - X-User-ID: 用户ID
 * - X-Timestamp: 请求时间戳（毫秒）
 * - X-Signature: HMAC-SHA256签名
 */
async function verifyAuth(req, res, next) {
    try {
        // 1. 提取项目ID（如未提供，使用默认项目）
        const projectId = req.headers['x-project-id'] || 'default';

        // 2. 验证项目是否存在且激活
        const project = await projectManager.getProject(projectId);
        if (!project) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_PROJECT',
                    message: `无效的项目ID: ${projectId}`,
                },
                timestamp: new Date().toISOString(),
            });
        }

        if (!project.isActive) {
            return res.status(403).json({
                success: false,
                data: null,
                error: {
                    code: 'PROJECT_INACTIVE',
                    message: '项目未激活',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 3. 获取项目专属的数据库连接池
        const pool = await dbManager.getPool(projectId);
        const devicesTable = await dbManager.getTableName(projectId, 'devices');

        // 4. 提取认证请求头（保持原逻辑）
        const apiKey = req.headers['x-api-key'];
        const deviceId = req.headers['x-device-id'];
        const userId = req.headers['x-user-id'];
        const timestamp = req.headers['x-timestamp'];
        const signature = req.headers['x-signature'];

        // 5. 验证必需字段是否存在
        if (!apiKey || !deviceId || !userId || !timestamp || !signature) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'MISSING_HEADERS',
                    message: '缺少必需的请求头',
                    required: ['X-API-Key', 'X-Device-ID', 'X-User-ID', 'X-Timestamp', 'X-Signature'],
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 6. 查询数据库获取设备信息（使用项目表）
        const deviceQuery = await pool.query(
            `SELECT * FROM ${devicesTable} 
             WHERE api_key = $1 AND device_id = $2 AND project_id = $3`,
            [apiKey, deviceId, projectId]
        );

        if (deviceQuery.rows.length === 0) {
            console.warn(`认证失败: 无效的API Key或设备ID - ${projectId}/${deviceId}`);
            return res.status(401).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: '无效的API Key或设备ID',
                },
                timestamp: new Date().toISOString(),
            });
        }

        const device = deviceQuery.rows[0];

        // 4. 检查设备是否被封禁
        if (device.is_banned) {
            console.warn(`认证失败: 设备已被封禁 - ${deviceId}`);
            return res.status(403).json({
                success: false,
                data: null,
                error: {
                    code: 'DEVICE_BANNED',
                    message: device.ban_reason || '设备已被封禁',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 5. 验证时间戳（5分钟窗口）
        const requestTimestamp = parseInt(timestamp, 10);
        const currentTimestamp = Date.now();
        const timeDifference = Math.abs(currentTimestamp - requestTimestamp);
        const maxTimeDifference = 5 * 60 * 1000; // 5分钟

        if (timeDifference > maxTimeDifference) {
            console.warn(`认证失败: 时间戳过期 - ${deviceId}, 时间差: ${timeDifference}ms`);
            return res.status(401).json({
                success: false,
                data: null,
                error: {
                    code: 'TIMESTAMP_EXPIRED',
                    message: '请求时间戳已过期（超过5分钟）',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 6. 重新计算签名并验证
        const method = req.method;
        const path = req.originalUrl; // 使用完整URL路径
        const body = JSON.stringify(req.body || {});

        const expectedSignature = generateSignature(
            method,
            path,
            requestTimestamp,
            deviceId,
            userId,
            body,
            device.secret_key
        );

        if (!verifySignature(signature, expectedSignature)) {
            console.warn(`认证失败: 签名无效 - ${deviceId}`);
            return res.status(401).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_SIGNATURE',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 7. 更新设备最后活跃时间（使用项目表）
        await pool.query(
            `UPDATE ${devicesTable} SET last_active_at = NOW() WHERE id = $1`,
            [device.id]
        );

        // 8. 将项目和设备信息附加到请求对象
        req.project = project;
        req.projectId = projectId;
        req.dbPool = pool;
        req.device = device;
        req.userId = userId;

        // 辅助函数：获取表名
        req.getTableName = async (baseName) => {
            return await dbManager.getTableName(projectId, baseName);
        };

        // 9. 认证成功，继续处理请求
        next();

    } catch (error) {
        console.error('认证中间件错误:', error);
        next(error);
    }
}

module.exports = {
    verifyAuth,
};
