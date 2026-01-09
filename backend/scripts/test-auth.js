#!/usr/bin/env node

/**
 * 测试脚本：验证签名生成和认证流程
 * 使用方法: node scripts/test-auth.js
 */

const crypto = require('../src/utils/crypto');

console.log('='.repeat(60));
console.log('认证功能测试脚本');
console.log('='.repeat(60));
console.log('');

// 测试1: 生成 API Key
console.log('测试1: 生成 API Key');
const apiKey = crypto.generateApiKey();
console.log(`  生成的 API Key: ${apiKey}`);
console.log(`  格式检查: ${apiKey.startsWith('api_live_') ? '✓ 通过' : '✗ 失败'}`);
console.log(`  长度检查: ${apiKey.length === 41 ? '✓ 通过' : '✗ 失败'} (期望41，实际${apiKey.length})`);
console.log('');

// 测试2: 生成 Secret Key
console.log('测试2: 生成 Secret Key');
const secretKey = crypto.generateSecretKey();
console.log(`  生成的 Secret Key: ${secretKey}`);
console.log(`  长度检查: ${secretKey.length === 64 ? '✓ 通过' : '✗ 失败'} (期望64，实际${secretKey.length})`);
console.log('');

// 测试3: 签名生成和验证
console.log('测试3: 签名生成和验证');
const method = 'POST';
const path = '/api/v1/events/track';
const timestamp = Date.now();
const deviceId = '550e8400-e29b-41d4-a716-446655440000';
const userId = '550e8400e29b41d4a716446655440000';
const body = JSON.stringify({ event_type: 'test_event' });

const signature = crypto.generateSignature(
    method,
    path,
    timestamp,
    deviceId,
    userId,
    body,
    secretKey
);

console.log(`  生成的签名: ${signature}`);
console.log(`  签名格式: Base64`);

// 验证签名
const isValid = crypto.verifySignature(signature, signature);
console.log(`  签名自验证: ${isValid ? '✓ 通过' : '✗ 失败'}`);

// 测试错误签名
const wrongSignature = crypto.generateSignature(
    method,
    path,
    timestamp,
    deviceId,
    userId,
    'wrong body',
    secretKey
);
const isInvalid = !crypto.verifySignature(signature, wrongSignature);
console.log(`  错误签名检测: ${isInvalid ? '✓ 通过' : '✗ 失败'}`);
console.log('');

// 测试4: UUID 验证
console.log('测试4: UUID 验证');
const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const invalidUUID = 'not-a-uuid';
console.log(`  有效UUID检测: ${crypto.isValidUUID(validUUID) ? '✓ 通过' : '✗ 失败'}`);
console.log(`  无效UUID检测: ${!crypto.isValidUUID(invalidUUID) ? '✓ 通过' : '✗ 失败'}`);
console.log('');

// 测试5: 用户ID 验证
console.log('测试5: 用户ID 验证');
const validUserId = '550e8400e29b41d4a716446655440000';
const invalidUserId = '550e8400-e29b-41d4-a716-446655440000'; // 带横线
console.log(`  有效用户ID检测: ${crypto.isValidUserId(validUserId) ? '✓ 通过' : '✗ 失败'}`);
console.log(`  无效用户ID检测: ${!crypto.isValidUserId(invalidUserId) ? '✓ 通过' : '✗ 失败'}`);
console.log('');

console.log('='.repeat(60));
console.log('测试完成！');
console.log('='.repeat(60));
console.log('');

// 输出示例请求
console.log('示例：设备注册请求');
console.log('curl -X POST http://localhost:3001/api/v1/auth/register \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"device_id":"550e8400-e29b-41d4-a716-446655440000","device_model":"iPhone15,2","os_version":"iOS 26.0","app_version":"1.0.0"}\'');
console.log('');
