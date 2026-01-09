const express = require('express');
const { verifyAuth } = require('../middleware/auth');
const { isValidUUID } = require('../utils/crypto');

const router = express.Router();

/**
 * 会话上传
 * POST /api/v1/sessions
 * 
 * 需要认证
 */
router.post('/', verifyAuth, async (req, res, next) => {
    try {
        const {
            session_id,
            session_start_time,
            session_duration_ms,
            device_model,
            os_version,
            app_version,
            build_number,
            screen_count,
            event_count,
        } = req.body;

        // 1. 验证必需字段 - session_id
        if (!session_id) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'MISSING_SESSION_ID',
                    message: '缺少会话ID（session_id）',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 2. 验证session_id格式
        if (!isValidUUID(session_id)) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_SESSION_ID',
                    message: '会话ID格式无效，必须是有效的UUID',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 3. 验证必需字段 - session_start_time
        if (!session_start_time) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'MISSING_SESSION_START_TIME',
                    message: '缺少会话开始时间（session_start_time）',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 4. 验证session_start_time格式（ISO 8601）
        const startTime = new Date(session_start_time);
        if (isNaN(startTime.getTime())) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_SESSION_START_TIME',
                    message: '会话开始时间格式无效，必须是ISO 8601格式',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 5. 从认证中间件获取设备和用户信息
        const deviceId = req.device.device_id;
        const userId = req.userId;

        // 6. 使用UPSERT存储到数据库（如存在则更新，使用项目表）
        const sessionsTable = await req.getTableName('sessions');
        await req.dbPool.query(
            `INSERT INTO ${sessionsTable}
       (session_id, device_id, user_id, session_start_time, session_duration_ms, 
        device_model, os_version, app_version, build_number, screen_count, event_count, project_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (session_id) 
       DO UPDATE SET 
         session_duration_ms = EXCLUDED.session_duration_ms,
         screen_count = EXCLUDED.screen_count,
         event_count = EXCLUDED.event_count,
         device_model = EXCLUDED.device_model,
         os_version = EXCLUDED.os_version,
         app_version = EXCLUDED.app_version,
         build_number = EXCLUDED.build_number`,
            [
                session_id,
                deviceId,
                userId,
                startTime,
                session_duration_ms || 0,
                device_model || req.device.device_model,
                os_version || req.device.os_version,
                app_version || req.device.app_version,
                build_number || null,
                screen_count || 0,
                event_count || 0,
                req.projectId,
            ]
        );

        console.log(`会话已记录: ${session_id}`);

        // 7. 返回成功响应
        res.status(201).json({
            success: true,
            data: {
                session_id: session_id,
            },
            error: null,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('会话上传失败:', error);
        next(error);
    }
});

module.exports = router;
