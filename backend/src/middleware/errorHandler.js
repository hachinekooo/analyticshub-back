/**
 * 统一错误处理中间件
 * 返回标准化的JSON错误响应
 */
function errorHandler(err, req, res, next) {
    // 记录错误日志
    console.error('错误:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    // 确定HTTP状态码
    const statusCode = err.statusCode || err.status || 500;

    // 确定错误代码
    const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

    // 确定错误消息
    const errorMessage =
        process.env.NODE_ENV === 'production'
            ? (statusCode === 500 ? '服务器内部错误' : err.message)
            : err.message;

    // 返回标准错误响应
    res.status(statusCode).json({
        success: false,
        data: null,
        error: {
            code: errorCode,
            message: errorMessage,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        },
        timestamp: new Date().toISOString(),
    });
}

/**
 * 404错误处理
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        data: null,
        error: {
            code: 'NOT_FOUND',
            message: `路径 ${req.path} 不存在`,
        },
        timestamp: new Date().toISOString(),
    });
}

module.exports = {
    errorHandler,
    notFoundHandler,
};
