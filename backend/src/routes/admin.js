const express = require('express');
const { requireAdminToken } = require('../middleware/adminAuth');
const { projectManager } = require('../config/projects');
const { dbManager } = require('../config/database');
const { initializeProjectDatabase } = require('../utils/dbInit');
const { Pool } = require('pg');

const router = express.Router();

// 所有管理接口都需要Token认证
router.use(requireAdminToken);

// 获取项目列表
router.get('/projects', async (req, res, next) => {
    try {
        const pool = dbManager.defaultPool;
        const result = await pool.query('SELECT * FROM analytics_projects ORDER BY created_at');

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error('获取项目列表失败:', error);
        next(error);
    }
});

// 创建项目
router.post('/projects', async (req, res, next) => {
    try {
        const { project_id, project_name, db_host, db_port, db_name, db_user, db_password, table_prefix } = req.body;

        const pool = dbManager.defaultPool;
        const result = await pool.query(
            `INSERT INTO analytics_projects 
       (project_id, project_name, db_host, db_port, db_name, db_user, db_password_encrypted, table_prefix)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [project_id, project_name, db_host, db_port || 5432, db_name, db_user, db_password, table_prefix || 'analytics_']
        );

        // 重新加载项目配置
        await projectManager.reloadProject(project_id);

        res.status(201).json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('创建项目失败:', error);
        next(error);
    }
});

// 更新项目
router.put('/projects/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { project_name, db_host, db_port, db_name, db_user, db_password, table_prefix, is_active } = req.body;

        const pool = dbManager.defaultPool;
        const result = await pool.query(
            `UPDATE analytics_projects 
       SET project_name = $1, db_host = $2, db_port = $3, db_name = $4, 
           db_user = $5, db_password_encrypted = $6, table_prefix = $7, is_active = $8
       WHERE id = $9
       RETURNING *`,
            [project_name, db_host, db_port, db_name, db_user, db_password, table_prefix, is_active, id]
        );

        if (result.rows.length > 0) {
            await projectManager.reloadProject(result.rows[0].project_id);
            res.json({ success: true, data: result.rows[0] });
        } else {
            res.status(404).json({ success: false, error: { message: '项目不存在' } });
        }
    } catch (error) {
        console.error('更新项目失败:', error);
        next(error);
    }
});

// 删除项目
router.delete('/projects/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const pool = dbManager.defaultPool;
        const result = await pool.query('DELETE FROM analytics_projects WHERE id = $1 RETURNING project_id', [id]);

        if (result.rows.length > 0) {
            const projectId = result.rows[0].project_id;
            await dbManager.closePool(projectId);
            res.json({ success: true, message: '项目已删除' });
        } else {
            res.status(404).json({ success: false, error: { message: '项目不存在' } });
        }
    } catch (error) {
        console.error('删除项目失败:', error);
        next(error);
    }
});

// 测试项目数据库连接
router.post('/projects/:id/test', async (req, res, next) => {
    try {
        const { id } = req.params;

        const pool = dbManager.defaultPool;
        const result = await pool.query('SELECT * FROM analytics_projects WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { message: '项目不存在' } });
        }

        const project = result.rows[0];

        // 尝试连接
        const testPool = new Pool({
            host: project.db_host,
            port: project.db_port,
            database: project.db_name,
            user: project.db_user,
            password: project.db_password_encrypted,
            connectionTimeoutMillis: 3000,
        });

        await testPool.query('SELECT 1');
        await testPool.end();

        res.json({ success: true, message: '数据库连接成功' });
    } catch (error) {
        console.error('测试连接失败:', error);
        res.status(500).json({ success: false, error: { message: '连接失败: ' + error.message } });
    }
});

// 初始化项目数据库
router.post('/projects/:id/init', async (req, res, next) => {
    try {
        const { id } = req.params;

        const pool = dbManager.defaultPool;
        const result = await pool.query('SELECT * FROM analytics_projects WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { message: '项目不存在' } });
        }

        const project = result.rows[0];

        // 转换为项目配置格式
        const projectConfig = {
            projectId: project.project_id,
            database: {
                host: project.db_host,
                port: project.db_port,
                database: project.db_name,
                user: project.db_user,
                password: project.db_password_encrypted,
            },
            tablePrefix: project.table_prefix,
        };

        const initResult = await initializeProjectDatabase(projectConfig);
        res.json(initResult);
    } catch (error) {
        console.error('初始化数据库失败:', error);
        res.status(500).json({ success: false, error: { message: '初始化失败: ' + error.message } });
    }
});

// 检查项目健康状态
router.get('/projects/:id/health', async (req, res, next) => {
    try {
        const { id } = req.params;

        const pool = dbManager.defaultPool;
        const result = await pool.query('SELECT * FROM analytics_projects WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { message: '项目不存在' } });
        }

        const project = result.rows[0];

        // 转换为项目配置格式
        const projectConfig = {
            projectId: project.project_id,
            database: {
                host: project.db_host,
                port: project.db_port,
                database: project.db_name,
                user: project.db_user,
                password: project.db_password_encrypted,
            },
            tablePrefix: project.table_prefix,
        };

        const { checkProjectHealth } = require('../utils/autoInit');
        const health = await checkProjectHealth(projectConfig);

        res.json({ success: true, data: health });
    } catch (error) {
        console.error('检查健康状态失败:', error);
        res.status(500).json({ success: false, error: { message: '检查失败: ' + error.message } });
    }
});

module.exports = router;
