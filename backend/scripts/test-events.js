#!/usr/bin/env node

/**
 * 事件追踪接口测试脚本
 * 测试单事件上传和批量事件上传
 */

const http = require('http');
const crypto = require('../src/utils/crypto');

const BASE_URL = 'http://localhost:3001';

// 测试设备信息（使用之前注册的设备）
const testDevice = {
    device_id: '550e8400-e29b-41d4-a716-446655440000',
    api_key: 'YOUR_API_KEY_HERE', // 从注册接口获取
    secret_key: '2a5465f5ef5e3ec4a5802092a95e5b48d4297862e1c1987a7e03ffcf956d1537',
};

const testUserId = '550e8400e29b41d4a716446655440000';

/**
 * HTTP请求辅助函数
 */
function makeRequest(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        };

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        data: JSON.parse(data),
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        data: data,
                    });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

/**
 * 生成认证头
 */
function getAuthHeaders(method, path, body = {}) {
    const timestamp = Date.now();
    const bodyStr = JSON.stringify(body);

    const signature = crypto.generateSignature(
        method,
        path,
        timestamp,
        testDevice.device_id,
        testUserId,
        bodyStr,
        testDevice.secret_key
    );

    return {
        'X-API-Key': testDevice.api_key,
        'X-Device-ID': testDevice.device_id,
        'X-User-ID': testUserId,
        'X-Timestamp': timestamp.toString(),
        'X-Signature': signature,
    };
}

/**
 * 主测试流程
 */
async function runTests() {
    console.log('='.repeat(70));
    console.log('事件追踪接口测试');
    console.log('='.repeat(70));
    console.log('');

    try {
        // 测试1: 单事件上传
        console.log('测试1: 单事件上传');

        const eventData = {
            event_type: 'test_event',
            timestamp: Date.now(),
            properties: {
                test_key: 'test_value',
                number_value: 123,
            },
            session_id: '550e8400-e29b-41d4-a716-446655440000',
        };

        const trackResponse = await makeRequest(
            'POST',
            '/api/v1/events/track',
            getAuthHeaders('POST', '/api/v1/events/track', eventData),
            eventData
        );

        if (trackResponse.statusCode === 201) {
            console.log(`  ✓ 上传成功`);
            console.log(`  事件ID: ${trackResponse.data.data.event_id}`);
        } else {
            console.log(`  ✗ 上传失败: HTTP ${trackResponse.statusCode}`);
            console.log(`  错误: ${JSON.stringify(trackResponse.data.error, null, 2)}`);
        }
        console.log('');

        // 测试2: 批量事件上传
        console.log('测试2: 批量事件上传（3个事件）');

        const batchData = {
            events: [
                {
                    event_type: 'batch_event_1',
                    timestamp: Date.now(),
                    properties: { index: 1 },
                    session_id: '550e8400-e29b-41d4-a716-446655440000',
                },
                {
                    event_type: 'batch_event_2',
                    timestamp: Date.now(),
                    properties: { index: 2 },
                    session_id: '550e8400-e29b-41d4-a716-446655440000',
                },
                {
                    event_type: 'batch_event_3',
                    timestamp: Date.now(),
                    properties: { index: 3 },
                    session_id: '550e8400-e29b-41d4-a716-446655440000',
                },
            ],
        };

        const batchResponse = await makeRequest(
            'POST',
            '/api/v1/events/batch',
            getAuthHeaders('POST', '/api/v1/events/batch', batchData),
            batchData
        );

        if (batchResponse.statusCode === 201) {
            console.log(`  ✓ 批量上传成功`);
            console.log(`  成功数量: ${batchResponse.data.data.accepted_count}`);
            console.log(`  失败数量: ${batchResponse.data.data.rejected_count}`);
            console.log(`  事件IDs: ${batchResponse.data.data.event_ids.slice(0, 3).join(', ')}...`);
        } else {
            console.log(`  ✗ 批量上传失败: HTTP ${batchResponse.statusCode}`);
            console.log(`  错误: ${JSON.stringify(batchResponse.data.error, null, 2)}`);
        }
        console.log('');

        // 测试3: 缺少event_type（应失败）
        console.log('测试3: 缺少event_type（应失败）');

        const invalidData = {
            timestamp: Date.now(),
            properties: { test: 'value' },
        };

        const invalidResponse = await makeRequest(
            'POST',
            '/api/v1/events/track',
            getAuthHeaders('POST', '/api/v1/events/track', invalidData),
            invalidData
        );

        if (invalidResponse.statusCode === 400) {
            console.log(`  ✓ 正确拒绝: ${invalidResponse.data.error.message}`);
        } else {
            console.log(`  ✗ 意外响应: HTTP ${invalidResponse.statusCode}`);
        }
        console.log('');

        // 测试4: 批量上传超过限制（应失败）
        console.log('测试4: 批量上传超过限制（应失败）');

        const oversizeBatchData = {
            events: Array(101).fill(null).map((_, i) => ({
                event_type: `event_${i}`,
                timestamp: Date.now(),
            })),
        };

        const oversizeResponse = await makeRequest(
            'POST',
            '/api/v1/events/batch',
            getAuthHeaders('POST', '/api/v1/events/batch', oversizeBatchData),
            oversizeBatchData
        );

        if (oversizeResponse.statusCode === 400) {
            console.log(`  ✓ 正确拒绝: ${oversizeResponse.data.error.message}`);
        } else {
            console.log(`  ✗ 意外响应: HTTP ${oversizeResponse.statusCode}`);
        }
        console.log('');

        console.log('='.repeat(70));
        console.log('所有测试完成！');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('测试失败:', error.message);
    }
}

// 运行测试
runTests();
