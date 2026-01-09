const express = require('express');
const { dbManager } = require('../config/database');
const { projectManager } = require('../config/projects');
const { generateApiKey, generateSecretKey, isValidUUID } = require('../utils/crypto');

const router = express.Router();

/**
 * 设备注册接口
 * POST /api/v1/auth/register
 * 
 * 请求体:
 * {
 *   "device_id": "550e8400-e29b-41d4-a716-446655440000",
 *   "device_model": "iPhone15,2",
 *   "os_version": "iOS 26.0",
 *   "app_version": "1.0.0"
 * }
 */
router.post('/register', async (req, res, next) => {
    try {
        const { device_id, device_model, os_version, app_version } = req.body;

        // 0. 提取并验证项目ID
        const projectId = req.headers['x-project-id'] || 'default';
        const project = await projectManager.getProject(projectId);
        if (!project || !project.isActive) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_PROJECT',
                    message: '无效或未激活的项目',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 获取项目数据库和表名
        const pool = await dbManager.getPool(projectId);
        const devicesTable = await dbManager.getTableName(projectId, 'devices');

        // 1. 验证必需字段
        if (!device_id) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'MISSING_DEVICE_ID',
                    message: '缺少设备ID',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 2. 验证 device_id 格式
        if (!isValidUUID(device_id)) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_DEVICE_ID',
                    message: '设备ID格式无效，必须是有效的UUID',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 3. 检查设备是否已注册（在项目内）
        const existingDevice = await pool.query(
            `SELECT api_key, secret_key FROM ${devicesTable} 
             WHERE device_id = $1 AND project_id = $2`,
            [device_id, projectId]
        );

        if (existingDevice.rows.length > 0) {
            // 设备已注册，返回现有密钥
            const device = existingDevice.rows[0];

            console.log(`设备已注册: ${projectId}/${device_id}`);

            return res.json({
                success: true,
                data: {
                    api_key: device.api_key,
                    secret_key: device.secret_key,
                    is_new: false,
                },
                error: null,
                timestamp: new Date().toISOString(),
            });
        }

        // 4. 生成新的 API Key 和 Secret Key
        const apiKey = generateApiKey();
        const secretKey = generateSecretKey();

        // 5. 存储到数据库（包含project_id）
        await pool.query(
            `INSERT INTO ${devicesTable}
             (device_id, api_key, secret_key, device_model, os_version, app_version, project_id, created_at, last_active_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [device_id, apiKey, secretKey, device_model, os_version, app_version, projectId]
        );

        console.log(`新设备注册成功: ${projectId}/${device_id}`);

        // 6. 返回密钥信息
        res.status(201).json({
            success: true,
            data: {
                api_key: apiKey,
                secret_key: secretKey,
                is_new: true,
            },
            error: null,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('设备注册失败:', error);
        next(error);
    }
});

module.exports = router;
