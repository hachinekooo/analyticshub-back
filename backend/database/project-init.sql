-- ============================================================
-- 项目数据库初始化脚本
-- 在项目专属数据库中创建analytics相关表
-- 使用占位符 {{PREFIX}} 来支持自定义表前缀
-- ============================================================

SET timezone = 'UTC';

-- 1. 设备注册表
CREATE TABLE IF NOT EXISTS {{PREFIX}}devices (
    id SERIAL PRIMARY KEY,
    device_id UUID NOT NULL UNIQUE,
    api_key VARCHAR(100) NOT NULL UNIQUE,
    secret_key VARCHAR(100) NOT NULL,
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    project_id VARCHAR(50) NOT NULL DEFAULT 'analytics-system',
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}devices_device_id ON {{PREFIX}}devices(device_id);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}devices_api_key ON {{PREFIX}}devices(api_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_{{PREFIX}}devices_project_device ON {{PREFIX}}devices(project_id, device_id);

-- 2. 事件记录表
CREATE TABLE IF NOT EXISTS {{PREFIX}}events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL UNIQUE,
    device_id UUID NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    session_id UUID,
    event_type VARCHAR(100) NOT NULL,
    event_timestamp BIGINT NOT NULL,
    properties JSONB,
    project_id VARCHAR(50) NOT NULL DEFAULT 'analytics-system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}events_device_id ON {{PREFIX}}events(device_id);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}events_user_id ON {{PREFIX}}events(user_id);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}events_event_type ON {{PREFIX}}events(event_type);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}events_created_at ON {{PREFIX}}events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}events_project_device ON {{PREFIX}}events(project_id, device_id);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}events_project_created ON {{PREFIX}}events(project_id, created_at DESC);

-- 3. 会话记录表
CREATE TABLE IF NOT EXISTS {{PREFIX}}sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL UNIQUE,
    device_id UUID NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    session_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    session_duration_ms BIGINT DEFAULT 0,
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    build_number VARCHAR(50),
    screen_count INTEGER DEFAULT 0,
    event_count INTEGER DEFAULT 0,
    project_id VARCHAR(50) NOT NULL DEFAULT 'analytics-system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}sessions_device_id ON {{PREFIX}}sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}sessions_user_id ON {{PREFIX}}sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}sessions_created_at ON {{PREFIX}}sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}sessions_project_device ON {{PREFIX}}sessions(project_id, device_id);

-- 4. 流量指标表
CREATE TABLE IF NOT EXISTS {{PREFIX}}traffic_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_id VARCHAR(64) NOT NULL UNIQUE,
    device_id UUID NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    session_id UUID,
    metric_type VARCHAR(50) NOT NULL,
    page_path VARCHAR(255),
    referrer VARCHAR(255),
    metric_timestamp BIGINT NOT NULL,
    metadata JSONB,
    project_id VARCHAR(50) NOT NULL DEFAULT 'analytics-system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}traffic_device_id ON {{PREFIX}}traffic_metrics(device_id);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}traffic_user_id ON {{PREFIX}}traffic_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}traffic_type ON {{PREFIX}}traffic_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}traffic_created_at ON {{PREFIX}}traffic_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}traffic_project_device ON {{PREFIX}}traffic_metrics(project_id, device_id);
CREATE INDEX IF NOT EXISTS idx_{{PREFIX}}traffic_project_created ON {{PREFIX}}traffic_metrics(project_id, created_at DESC);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✓ 项目表初始化完成！';
    RAISE NOTICE '  - {{PREFIX}}devices';
    RAISE NOTICE '  - {{PREFIX}}events';
    RAISE NOTICE '  - {{PREFIX}}sessions';
    RAISE NOTICE '  - {{PREFIX}}traffic_metrics';
END $$;
