const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

/**
 * 健康检查接口
 * GET /health
 */
router.get('/', async (req, res, next) => {
    try {
        // 检查数据库连接
        let databaseStatus = 'disconnected';
        try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            databaseStatus = 'connected';
        } catch (dbError) {
            console.error('数据库健康检查失败:', dbError.message);
        }

        // 返回健康状态
        res.json({
            success: true,
            data: {
                status: 'healthy',
                database: databaseStatus,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
            },
            error: null,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
