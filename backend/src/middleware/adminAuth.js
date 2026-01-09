/**
 * 管理后台Token认证中间件
 * 简单的固定Token认证，仅供管理员使用
 */

function requireAdminToken(req, res, next) {
    // 从查询参数或请求头获取token
    const token = req.query.token || req.headers['x-admin-token'];

    // 验证token
    const adminToken = process.env.ADMIN_TOKEN;

    if (!adminToken) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'ADMIN_TOKEN_NOT_CONFIGURED',
                message: '管理员Token未配置，请在环境变量中设置ADMIN_TOKEN',
            },
        });
    }

    if (token && token === adminToken) {
        next();
    } else {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: '未授权：无效的管理员Token',
            },
        });
    }
}

module.exports = { requireAdminToken };
