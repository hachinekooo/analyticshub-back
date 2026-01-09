-- ============================================
-- 数据清理脚本 - 90天保留策略
-- ============================================
-- 用途: 定期清理过期数据，保持数据库性能
-- 建议: 通过Cron定时任务每天执行一次
-- ============================================

-- 删除90天前的事件记录
DELETE FROM analytics_events 
WHERE created_at < NOW() - INTERVAL '90 days';

-- 删除90天前的会话记录
DELETE FROM analytics_sessions 
WHERE created_at < NOW() - INTERVAL '90 days';

-- 删除90天前的流量指标
DELETE FROM analytics_traffic_metrics 
WHERE created_at < NOW() - INTERVAL '90 days';

-- 真空清理（回收存储空间）
VACUUM ANALYZE analytics_events;
VACUUM ANALYZE analytics_sessions;
VACUUM ANALYZE analytics_traffic_metrics;

-- 显示清理结果
DO $$
DECLARE
    events_count BIGINT;
    sessions_count BIGINT;
    traffic_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO events_count FROM analytics_events;
    SELECT COUNT(*) INTO sessions_count FROM analytics_sessions;
    SELECT COUNT(*) INTO traffic_count FROM analytics_traffic_metrics;
    
    RAISE NOTICE '✓ 数据清理完成！';
    RAISE NOTICE '  - 事件记录: % 条', events_count;
    RAISE NOTICE '  - 会话记录: % 条', sessions_count;
    RAISE NOTICE '  - 流量指标: % 条', traffic_count;
END $$;
