const express = require('express');
const { verifyAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * 受保护的测试接口
 * 用于验证认证中间件是否正常工作
 * GET /api/v1/protected/test
 */
router.get('/test', verifyAuth, (req, res) => {
    res.json({
        success: true,
        data: {
            message: '认证成功！',
            device_id: req.device.device_id,
            user_id: req.userId,
            device_model: req.device.device_model,
            last_active: req.device.last_active_at,
        },
        error: null,
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
