#!/usr/bin/env node

/**
 * 会话管理接口测试脚本
 * 测试会话上传和重复上传（UPSERT）
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
    console.log('会话管理接口测试');
    console.log('='.repeat(70));
    console.log('');

    try {
        const testSessionId = '550e8400-e29b-41d4-a716-446655440000';

        // 测试1: 首次会话上传
        console.log('测试1: 首次会话上传');

        const sessionData = {
            session_id: testSessionId,
            session_start_time: new Date().toISOString(),
            session_duration_ms: 300000,
            device_model: 'iPhone15,2',
            os_version: 'iOS 26.0',
            app_version: '1.0.0',
            build_number: '123',
            screen_count: 5,
            event_count: 12,
        };

        const uploadResponse = await makeRequest(
            'POST',
            '/api/v1/sessions',
            getAuthHeaders('POST', '/api/v1/sessions', sessionData),
            sessionData
        );

        if (uploadResponse.statusCode === 201) {
            console.log(`  ✓ 上传成功`);
            console.log(`  会话ID: ${uploadResponse.data.data.session_id}`);
        } else {
            console.log(`  ✗ 上传失败: HTTP ${uploadResponse.statusCode}`);
            console.log(`  错误: ${JSON.stringify(uploadResponse.data.error, null, 2)}`);
        }
        console.log('');

        // 测试2: 重复上传（更新会话）
        console.log('测试2: 重复上传（UPSERT - 更新现有会话）');

        const updatedSessionData = {
            session_id: testSessionId,
            session_start_time: sessionData.session_start_time,
            session_duration_ms: 600000,  // 更新时长
            device_model: 'iPhone15,2',
            os_version: 'iOS 26.0',
            app_version: '1.0.0',
            build_number: '123',
            screen_count: 10,  // 更新页面数
            event_count: 25,   // 更新事件数
        };

        const updateResponse = await makeRequest(
            'POST',
            '/api/v1/sessions',
            getAuthHeaders('POST', '/api/v1/sessions', updatedSessionData),
            updatedSessionData
        );

        if (updateResponse.statusCode === 201) {
            console.log(`  ✓ 更新成功`);
            console.log(`  会话ID: ${updateResponse.data.data.session_id}`);
            console.log(`  新时长: ${updatedSessionData.session_duration_ms}ms`);
            console.log(`  新页面数: ${updatedSessionData.screen_count}`);
            console.log(`  新事件数: ${updatedSessionData.event_count}`);
        } else {
            console.log(`  ✗ 更新失败: HTTP ${updateResponse.statusCode}`);
            console.log(`  错误: ${JSON.stringify(updateResponse.data.error, null, 2)}`);
        }
        console.log('');

        // 测试3: 缺少session_id（应失败）
        console.log('测试3: 缺少session_id（应失败）');

        const invalidData = {
            session_start_time: new Date().toISOString(),
            session_duration_ms: 300000,
        };

        const invalidResponse1 = await makeRequest(
            'POST',
            '/api/v1/sessions',
            getAuthHeaders('POST', '/api/v1/sessions', invalidData),
            invalidData
        );

        if (invalidResponse1.statusCode === 400) {
            console.log(`  ✓ 正确拒绝: ${invalidResponse1.data.error.message}`);
        } else {
            console.log(`  ✗ 意外响应: HTTP ${invalidResponse1.statusCode}`);
        }
        console.log('');

        // 测试4: session_id格式错误（应失败）
        console.log('测试4: session_id格式错误（应失败）');

        const invalidIdData = {
            session_id: 'invalid-id',
            session_start_time: new Date().toISOString(),
            session_duration_ms: 300000,
        };

        const invalidResponse2 = await makeRequest(
            'POST',
            '/api/v1/sessions',
            getAuthHeaders('POST', '/api/v1/sessions', invalidIdData),
            invalidIdData
        );

        if (invalidResponse2.statusCode === 400) {
            console.log(`  ✓ 正确拒绝: ${invalidResponse2.data.error.message}`);
        } else {
            console.log(`  ✗ 意外响应: HTTP ${invalidResponse2.statusCode}`);
        }
        console.log('');

        // 测试5: 缺少session_start_time（应失败）
        console.log('测试5: 缺少session_start_time（应失败）');

        const noStartTimeData = {
            session_id: '650e8400-e29b-41d4-a716-446655440000',
            session_duration_ms: 300000,
        };

        const invalidResponse3 = await makeRequest(
            'POST',
            '/api/v1/sessions',
            getAuthHeaders('POST', '/api/v1/sessions', noStartTimeData),
            noStartTimeData
        );

        if (invalidResponse3.statusCode === 400) {
            console.log(`  ✓ 正确拒绝: ${invalidResponse3.data.error.message}`);
        } else {
            console.log(`  ✗ 意外响应: HTTP ${invalidResponse3.statusCode}`);
        }
        console.log('');

        console.log('='.repeat(70));
        console.log('所有测试完成！');
        console.log('='.repeat(70));
        console.log('');
        console.log('提示：运行以下命令验证数据库中的会话数据：');
        console.log('docker exec -i infra-postgres15 psql -U root -d analytics \\');
        console.log('  -c "SELECT * FROM analytics_sessions ORDER BY created_at DESC LIMIT 5;"');

    } catch (error) {
        console.error('测试失败:', error.message);
    }
}

// 运行测试
runTests();
