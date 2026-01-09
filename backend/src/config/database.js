const { Pool } = require('pg');
const { projectManager } = require('./projects');

/**
 * 动态数据库管理器
 * 管理多个项目的数据库连接池
 */
class DatabaseManager {
  constructor() {
    this.pools = new Map();
    // 默认连接池（用于查询项目配置）
    this.defaultPool = null;
  }

  /**
   * 初始化默认数据库连接池
   */
  initializeDefaultPool() {
    if (this.defaultPool) return;

    this.defaultPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'analytics',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.defaultPool.on('error', (err) => {
      console.error('默认数据库连接池错误:', err);
    });

    console.log('✓ 默认数据库连接池已初始化');
  }

  /**
   * 获取数据库连接池
   * @param {string} projectId - 项目ID
   * @returns {Pool} 数据库连接池
   */
  async getPool(projectId = 'default') {
    // 如果已有连接池，直接返回
    if (this.pools.has(projectId)) {
      return this.pools.get(projectId);
    }

    // 获取项目配置
    const project = await projectManager.getProject(projectId);
    if (!project) {
      throw new Error(`项目不存在: ${projectId}`);
    }

    // 创建新的连接池
    const pool = new Pool({
      host: project.database.host,
      port: project.database.port,
      database: project.database.database,
      user: project.database.user,
      password: project.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error(`数据库连接池错误 (${projectId}):`, err);
    });

    this.pools.set(projectId, pool);
    console.log(`✓ 项目 ${projectId} 数据库连接池已创建`);

    return pool;
  }

  /**
   * 获取表名（带项目前缀）
   * @param {string} projectId - 项目ID
   * @param {string} baseName - 基础表名（如 'devices', 'events'）
   * @returns {string} 完整表名
   */
  async getTableName(projectId, baseName) {
    const project = await projectManager.getProject(projectId);
    if (!project) {
      throw new Error(`项目不存在: ${projectId}`);
    }
    return `${project.tablePrefix}${baseName}`;
  }

  /**
   * 关闭指定项目的连接池
   */
  async closePool(projectId) {
    const pool = this.pools.get(projectId);
    if (pool) {
      await pool.end();
      this.pools.delete(projectId);
      console.log(`✓ 项目 ${projectId} 数据库连接池已关闭`);
    }
  }

  /**
   * 关闭所有连接池
   */
  async closeAll() {
    console.log('正在关闭所有数据库连接池...');

    // 关闭项目连接池
    for (const [projectId, pool] of this.pools.entries()) {
      try {
        await pool.end();
        console.log(`✓ 项目 ${projectId} 连接池已关闭`);
      } catch (error) {
        console.error(`关闭项目 ${projectId} 连接池失败:`, error);
      }
    }
    this.pools.clear();

    // 关闭默认连接池
    if (this.defaultPool) {
      try {
        await this.defaultPool.end();
        console.log('✓ 默认连接池已关闭');
      } catch (error) {
        console.error('关闭默认连接池失败:', error);
      }
    }
  }

  /**
   * 测试连接
   */
  async testConnection(projectId) {
    try {
      const pool = await this.getPool(projectId);
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error(`项目 ${projectId} 数据库连接测试失败:`, error);
      return false;
    }
  }
}

// 创建单例
const dbManager = new DatabaseManager();
dbManager.initializeDefaultPool();

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到SIGTERM信号');
  await dbManager.closeAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('收到SIGINT信号');
  await dbManager.closeAll();
  process.exit(0);
});

// 兼容导出（向后兼容）
const pool = dbManager.defaultPool;
const testConnection = async () => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  pool,  // 保持向后兼容
  testConnection,  // 保持向后兼容
  dbManager,  // 新的多项目管理器
};
