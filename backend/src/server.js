/**
 * Analytics API Service - Main Server
 * 
 * 多项目analytics数据收集和分析API服务
 * 支持多个项目共享一个后端服务，每个项目可配置独立数据库
 * 
 * @author Your Name
 * @license MIT
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { testConnection } = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3001;

// ============ 中间件配置 ============
// 安全头部（调整CSP以支持管理后台Vue CDN）
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://unpkg.com"],
        },
    },
}));

// CORS配置
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Device-ID', 'X-User-ID', 'X-Timestamp', 'X-Signature', 'X-App-Version'],
}));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        data: null,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: '请求过于频繁，请稍后再试',
        },
        timestamp: new Date().toISOString(),
    },
});
app.use(limiter);

// 请求日志
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// ============ 路由配置 ============

// 健康检查
app.use('/health', healthRouter);

// 认证路由
const authRouter = require('./routes/auth');
app.use('/api/v1/auth', authRouter);

// 受保护的测试路由
const protectedRouter = require('./routes/protected');
app.use('/api/v1/protected', protectedRouter);

// 事件追踪路由
const eventsRouter = require('./routes/events');
app.use('/api/v1/events', eventsRouter);

// 会话管理路由
const sessionsRouter = require('./routes/sessions');
app.use('/api/v1/sessions', sessionsRouter);

// 管理后台路由
const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

// 静态文件服务（管理后台界面）
app.use(express.static('public'));

// API路由（预留）

// ============ 错误处理 ============

// 404处理
app.use(notFoundHandler);

// 统一错误处理
app.use(errorHandler);

// ============ 服务器启动 ============

async function startServer() {
    try {
        // 1. 自动初始化系统表
        const { autoInitSystemDatabase } = require('./utils/autoInit');
        await autoInitSystemDatabase();

        // 2. 测试数据库连接
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.warn('⚠ 警告: 数据库连接失败，但服务器将继续启动');
        }

        // 3. 启动HTTP服务器
        app.listen(PORT, () => {
            console.log('');
            console.log('='.repeat(50));
            console.log(`✓ 分析API服务已启动`);
            console.log(`  端口: ${PORT}`);
            console.log(`  环境: ${process.env.NODE_ENV || 'development'}`);
            console.log(`  健康检查: http://localhost:${PORT}/health`);
            console.log('='.repeat(50));
            console.log('');
        });
    } catch (error) {
        console.error('✗ 服务器启动失败:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();

module.exports = app;
