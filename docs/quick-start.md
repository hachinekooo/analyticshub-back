# 快速开始

## 5分钟快速部署

### 前提条件

- Node.js 18+
- PostgreSQL 15+
- pnpm (推荐) 或 npm

### PostgreSQL 安装

<details>
<summary>macOS</summary>

```bash
brew install postgresql@15
brew services start postgresql@15
```
</details>

<details>
<summary>Ubuntu/Debian</summary>

```bash
sudo apt install postgresql-15
sudo systemctl start postgresql
```
</details>

<details>
<summary>Docker (推荐开发环境)</summary>

```bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=analytics \
  -p 5432:5432 \
  postgres:15-alpine
```
</details>

### 部署步骤

#### 1. 克隆并安装

```bash
git clone <your-repo>
cd backend
pnpm install
```

#### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`:
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=analytics
DB_USER=postgres
DB_PASSWORD=your_password

# 管理Token (换成强随机值！)
ADMIN_TOKEN=your-secure-random-token
```

> 💡 生成强随机Token: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### 3. 启动服务

```bash
pnpm run dev
```

服务会**自动初始化**：
1. ✅ 检查数据库是否存在 → 不存在则创建
2. ✅ 检查表是否存在 → 不存在则执行初始化
3. ✅ 启动在 3001 端口

看到以下输出表示成功：
```bash
✓ 默认数据库连接池已初始化
✓ 分析API服务已启动
  端口: 3001
```

#### 4. 访问管理后台

打开浏览器访问：
```
http://localhost:3001/admin.html?token=your-secure-random-token
```

#### 5. 添加第一个项目

1. 点击 **"+ 添加项目"**
2. 填写项目信息：
   - 项目ID: `memobox`
   - 数据库名: `memobox` (需预先创建)
   - 其他配置...
3. 点击 **"检查状态"** 确认连接
4. 点击 **"初始化"** 创建数据库表
5. 完成！✅

## 客户端接入

### iOS 示例

```swift
// 1. 配置请求头
var request = URLRequest(url: url)
request.setValue("memobox", forHTTPHeaderField: "X-Project-ID")
request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

// 2. 注册设备
POST /api/v1/auth/register
{
  "device_id": "xxx",
  "device_model": "iPhone 14 Pro"
}

// 3. 上报事件
POST /api/v1/events
{
  "event_type": "button_click",
  "properties": {"button_id": "login"}
}
```

### Android 示例

```kotlin
// 添加请求头
headers["X-Project-ID"] = "memobox"
headers["X-API-Key"] = apiKey
```

### Web 示例

```javascript
// Axios
axios.defaults.headers.common['X-Project-ID'] = 'memobox';
axios.defaults.headers.common['X-API-Key'] = apiKey;
```

## 常见问题

### Q: 数据库连接失败？

检查：
- PostgreSQL 是否启动
- `.env` 配置是否正确
- 数据库用户权限

```bash
# 测试连接
psql -U postgres -d analytics
```

### Q: 管理后台打不开？

检查：
- Token 是否正确
- 服务是否启动（端口3001）
- 浏览器控制台错误

### Q: 项目初始化失败？

- 确认项目数据库已创建
- 检查数据库用户权限
- 查看服务器日志

## 下一步

- 📖 [架构设计](./architecture.md) - 了解系统设计
- 🎛️ [管理后台使用指南](./admin-guide.md) - 详细功能说明
- 📊 查看API文档 - 接口详细信息

## 生产部署

### 环境变量

生产环境建议设置：
```env
NODE_ENV=production
PORT=3001
DB_HOST=your-prod-db-host
ADMIN_TOKEN=<strong-random-value>
```

### 使用PM2

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start src/server.js --name analytics-api

# 开机自启
pm2 startup
pm2 save
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 故障排查

### 查看日志

```bash
# 开发环境
pnpm run dev  # 直接查看输出

# PM2环境
pm2 logs analytics-api
```

### 数据库检查

```bash
# 连接数据库
psql -U postgres -d analytics

# 查看项目列表
SELECT * FROM analytics_projects;

# 查看表
\dt analytics_*
```

### 端口被占用

```bash
# 查找占用进程
lsof -ti:3001

# 杀掉进程
kill -9 $(lsof -ti:3001)
```
