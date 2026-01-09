const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * 自动初始化分析系统数据库
 * 1. 检查并创建数据库（如不存在）
 * 2. 检查并创建表（读取init.sql）
 */
async function autoInitSystemDatabase() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
    };
    const targetDatabase = process.env.DB_NAME || 'analytics';

    // 第一步：连接到postgres默认库，检查目标数据库是否存在
    let postgresPool = new Pool({
        ...dbConfig,
        database: 'postgres', // 连接到默认数据库
    });

    try {
        // 检查目标数据库是否存在
        const dbCheckResult = await postgresPool.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [targetDatabase]
        );

        if (dbCheckResult.rows.length === 0) {
            console.log(`⚙️  检测到数据库 ${targetDatabase} 不存在，正在自动创建...`);
            // 创建数据库（注意：不能用参数化查询）
            await postgresPool.query(`CREATE DATABASE ${targetDatabase}`);
            console.log(`✓ 数据库 ${targetDatabase} 创建成功`);
        }

        await postgresPool.end();
    } catch (error) {
        console.error('✗ 数据库检查/创建失败:', error.message);
        await postgresPool.end();
        return false;
    }

    // 第二步：连接到目标数据库，初始化表
    const pool = new Pool({
        ...dbConfig,
        database: targetDatabase,
    });

    try {
        // 检查analytics_projects表是否存在
        const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'analytics_projects'
      );
    `);

        if (!checkResult.rows[0].exists) {
            console.log('⚙️  检测到analytics_projects表不存在，正在自动创建...');

            // 读取并执行init.sql（只维护一处SQL）
            const sqlPath = path.join(__dirname, '../../database/init.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');

            await pool.query(sql);
            console.log('✓ 系统表初始化成功');
        }

        await pool.end();
        return true;
    } catch (error) {
        console.error('✗ 表初始化失败:', error.message);
        await pool.end();
        return false;
    }
}

/**
 * 检查项目表健康状态
 * @param {Object} projectConfig - 项目配置
 * @returns {Promise<Object>} 健康状态
 */
async function checkProjectHealth(projectConfig) {
    const pool = new Pool({
        host: projectConfig.database.host,
        port: projectConfig.database.port,
        database: projectConfig.database.database,
        user: projectConfig.database.user,
        password: projectConfig.database.password,
        connectionTimeoutMillis: 3000,
    });

    try {
        const prefix = projectConfig.tablePrefix || 'analytics_';
        const requiredTables = ['devices', 'events', 'sessions', 'traffic_metrics'];
        const health = {
            connected: false,
            tables: {},
            allTablesExist: false,
        };

        // 测试连接
        await pool.query('SELECT 1');
        health.connected = true;

        // 检查每个表是否存在
        for (const tableName of requiredTables) {
            const fullTableName = `${prefix}${tableName}`;
            const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [fullTableName]);

            health.tables[tableName] = result.rows[0].exists;
        }

        // 判断是否所有表都存在
        health.allTablesExist = Object.values(health.tables).every(exists => exists);

        await pool.end();
        return health;
    } catch (error) {
        await pool.end();
        return {
            connected: false,
            error: error.message,
            tables: {},
            allTablesExist: false,
        };
    }
}

module.exports = {
    autoInitSystemDatabase,
    checkProjectHealth,
};
