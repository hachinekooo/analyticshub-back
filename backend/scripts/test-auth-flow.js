#!/usr/bin/env node

/**
 * 完整的认证流程测试
 * 测试设备注册 -> 生成签名 -> 调用受保护接口
 */

const http = require('http');
const crypto = require('../src/utils/crypto');

const BASE_URL = 'http://localhost:3001';

// 测试设备信息
const testDevice = {
    device_id: '550e8400-e29b-41d4-a716-446655440000',
    device_model: 'iPhone15,2',
    os_version: 'iOS 26.0',
    app_version: '1.0.0',
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
 * 主测试流程
 */
async function runTests() {
    console.log('='.repeat(70));
    console.log('认证流程完整测试');
    console.log('='.repeat(70));
    console.log('');

    try {
        // 测试1: 设备注册
        console.log('测试1: 设备注册');
        console.log(`  设备ID: ${testDevice.device_id}`);

        const registerResponse = await makeRequest(
            'POST',
            '/api/v1/auth/register',
            {},
            testDevice
        );

        if (registerResponse.statusCode !== 201 && registerResponse.statusCode !== 200) {
            console.log(`  ✗ 失败: HTTP ${registerResponse.statusCode}`);
            console.log(`  响应: ${JSON.stringify(registerResponse.data, null, 2)}`);
            return;
        }

        const { api_key, secret_key, is_new } = registerResponse.data.data;
        console.log(`  ✓ 注册成功`);
        console.log(`  API Key: ${api_key}`);
        console.log(`  Secret Key: ${secret_key.substring(0, 20)}...`);
        console.log(`  是否新设备: ${is_new ? '是' : '否'}`);
        console.log('');

        // 测试2: 无认证访问受保护接口（应失败）
        console.log('测试2: 无认证访问受保护接口');
        const unauthResponse = await makeRequest('GET', '/api/v1/protected/test');

        if (unauthResponse.statusCode === 400) {
            console.log(`  ✓ 正确拒绝: ${unauthResponse.data.error.message}`);
        } else {
            console.log(`  ✗ 意外响应: HTTP ${unauthResponse.statusCode}`);
        }
        console.log('');

        // 测试3: 有效签名访问受保护接口
        console.log('测试3: 有效签名访问受保护接口');

        const method = 'GET';
        const path = '/api/v1/protected/test';
        const timestamp = Date.now();
        const body = '{}';  // GET请求也需要空对象

        const signature = crypto.generateSignature(
            method,
            path,
            timestamp,
            testDevice.device_id,
            testUserId,
            body,
            secret_key
        );

        console.log(`  时间戳: ${timestamp}`);
        console.log(`  签名: ${signature.substring(0, 30)}...`);

        const authResponse = await makeRequest(
            method,
            path,
            {
                'X-API-Key': api_key,
                'X-Device-ID': testDevice.device_id,
                'X-User-ID': testUserId,
                'X-Timestamp': timestamp.toString(),
                'X-Signature': signature,
            }
        );

        if (authResponse.statusCode === 200) {
            console.log(`  ✓ 认证成功`);
            console.log(`  响应消息: ${authResponse.data.data.message}`);
            console.log(`  设备型号: ${authResponse.data.data.device_model}`);
        } else {
            console.log(`  ✗ 认证失败: HTTP ${authResponse.statusCode}`);
            console.log(`  错误: ${JSON.stringify(authResponse.data.error, null, 2)}`);
        }
        console.log('');

        // 测试4: 无效签名（应失败）
        console.log('测试4: 无效签名访问');

        const invalidSignature = 'invalid_signature_base64==';
        const invalidAuthResponse = await makeRequest(
            method,
            path,
            {
                'X-API-Key': api_key,
                'X-Device-ID': testDevice.device_id,
                'X-User-ID': testUserId,
                'X-Timestamp': timestamp.toString(),
                'X-Signature': invalidSignature,
            }
        );

        if (invalidAuthResponse.statusCode === 401) {
            console.log(`  ✓ 正确拒绝: ${invalidAuthResponse.data.error.message}`);
        } else {
            console.log(`  ✗ 意外响应: HTTP ${invalidAuthResponse.statusCode}`);
        }
        console.log('');

        // 测试5: 过期时间戳（应失败）
        console.log('测试5: 过期时间戳访问');

        const expiredTimestamp = Date.now() - (6 * 60 * 1000); // 6分钟前
        const expiredSignature = crypto.generateSignature(
            method,
            path,
            expiredTimestamp,
            testDevice.device_id,
            testUserId,
            body,
            secret_key
        );

        const expiredResponse = await makeRequest(
            method,
            path,
            {
                'X-API-Key': api_key,
                'X-Device-ID': testDevice.device_id,
                'X-User-ID': testUserId,
                'X-Timestamp': expiredTimestamp.toString(),
                'X-Signature': expiredSignature,
            }
        );

        if (expiredResponse.statusCode === 401) {
            console.log(`  ✓ 正确拒绝: ${expiredResponse.data.error.message}`);
        } else {
            console.log(`  ✗ 意外响应: HTTP ${expiredResponse.statusCode}`);
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
