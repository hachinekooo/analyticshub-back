const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * 初始化项目数据库
 * 读取并执行 database/project-init.sql
 * @param {Object} projectConfig - 项目配置
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function initializeProjectDatabase(projectConfig) {
    let pool;
    try {
        // 创建连接池
        pool = new Pool({
            host: projectConfig.database.host,
            port: projectConfig.database.port,
            database: projectConfig.database.database,
            user: projectConfig.database.user,
            password: projectConfig.database.password,
        });

        // 读取SQL模板
        const sqlPath = path.join(__dirname, '../../database/project-init.sql');
        let sql = fs.readFileSync(sqlPath, 'utf8');

        // 替换表前缀占位符
        const prefix = projectConfig.tablePrefix || 'analytics_';
        sql = sql.replace(/\{\{PREFIX\}\}/g, prefix);

        // 执行SQL
        await pool.query(sql);

        await pool.end();

        return {
            success: true,
            message: `项目 ${projectConfig.projectId} 数据库初始化成功`,
            tables: [`${prefix}devices`, `${prefix}events`, `${prefix}sessions`, `${prefix}traffic_metrics`],
        };
    } catch (error) {
        if (pool) {
            await pool.end();
        }
        throw error;
    }
}

module.exports = {
    initializeProjectDatabase,
};
