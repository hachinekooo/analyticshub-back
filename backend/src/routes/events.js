const express = require('express');
const { verifyAuth } = require('../middleware/auth');
const { generateEventId, isValidUUID } = require('../utils/crypto');

const router = express.Router();

/**
 * 单事件上传
 * POST /api/v1/events/track
 * 
 * 需要认证
 */
router.post('/track', verifyAuth, async (req, res, next) => {
    try {
        const { event_type, timestamp, properties, session_id } = req.body;

        // 1. 验证必需字段
        if (!event_type) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'MISSING_EVENT_TYPE',
                    message: '缺少事件类型（event_type）',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 2. 验证timestamp格式
        const eventTimestamp = timestamp || Date.now();
        if (typeof eventTimestamp !== 'number') {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_TIMESTAMP',
                    message: '时间戳必须是数字',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 3. 验证session_id格式（可选）
        if (session_id && !isValidUUID(session_id)) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_SESSION_ID',
                    message: '会话ID格式无效',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 4. 生成事件ID
        const eventId = generateEventId();

        // 5. 从认证中间件获取设备和用户信息
        const deviceId = req.device.device_id;
        const userId = req.userId;

        // 6. 存储到数据库（使用项目表）
        const eventsTable = await req.getTableName('events');
        await req.dbPool.query(
            `INSERT INTO ${eventsTable}
       (event_id, device_id, user_id, session_id, event_type, event_timestamp, properties, project_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
                eventId,
                deviceId,
                userId,
                session_id || null,
                event_type,
                eventTimestamp,
                properties ? JSON.stringify(properties) : null,
                req.projectId,
            ]
        );

        console.log(`事件已记录: ${event_type} (${eventId})`);

        // 7. 返回成功响应
        res.status(201).json({
            success: true,
            data: {
                event_id: eventId,
            },
            error: null,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('事件追踪失败:', error);
        next(error);
    }
});

/**
 * 批量事件上传
 * POST /api/v1/events/batch
 * 
 * 需要认证
 */
router.post('/batch', verifyAuth, async (req, res, next) => {
    try {
        const { events } = req.body;

        // 1. 验证events数组
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'INVALID_EVENTS',
                    message: 'events必须是数组',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 2. 验证批量大小限制（最多100个）
        if (events.length === 0) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'EMPTY_EVENTS',
                    message: 'events数组不能为空',
                },
                timestamp: new Date().toISOString(),
            });
        }

        if (events.length > 100) {
            return res.status(400).json({
                success: false,
                data: null,
                error: {
                    code: 'BATCH_SIZE_EXCEEDED',
                    message: '单次最多上传100个事件',
                },
                timestamp: new Date().toISOString(),
            });
        }

        // 3. 从认证中间件获取设备和用户信息
        const deviceId = req.device.device_id;
        const userId = req.userId;

        // 4. 准备批量插入数据 (包含project_id)
        const eventIds = [];
        const values = [];
        const placeholders = [];

        for (let i = 0; i < events.length; i++) {
            const event = events[i];

            // 验证event_type
            if (!event.event_type) {
                console.warn(`跳过无效事件（缺少event_type）: ${JSON.stringify(event)}`);
                continue;
            }

            const eventId = generateEventId();
            const eventTimestamp = event.timestamp || Date.now();
            const sessionId = event.session_id || null;
            const properties = event.properties ? JSON.stringify(event.properties) : null;

            eventIds.push(eventId);

            // 添加参数值(包含project_id)
            const baseIndex = i * 8;
            values.push(
                eventId,
                deviceId,
                userId,
                sessionId,
                event.event_type,
                eventTimestamp,
                properties,
                req.projectId
            );

            // 添加占位符
            placeholders.push(
                `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, NOW())`
            );
        }

        // 5. 批量插入到数据库（使用项目表）
        if (eventIds.length > 0) {
            const eventsTable = await req.getTableName('events');
            const query = `
        INSERT INTO ${eventsTable}
        (event_id, device_id, user_id, session_id, event_type, event_timestamp, properties, project_id, created_at) 
        VALUES ${placeholders.join(', ')}
      `;

            await req.dbPool.query(query, values);

            console.log(`批量事件已记录: ${eventIds.length} 个事件`);
        }

        // 6. 返回成功响应
        const acceptedCount = eventIds.length;
        const rejectedCount = events.length - acceptedCount;

        res.status(201).json({
            success: true,
            data: {
                accepted_count: acceptedCount,
                rejected_count: rejectedCount,
                event_ids: eventIds,
            },
            error: null,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('批量事件追踪失败:', error);
        next(error);
    }
});

module.exports = router;
