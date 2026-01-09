# API 接口文档

## 认证机制

Analytics Hub 使用 **API Key + HMAC签名** 的双重认证机制来确保数据安全。

### 核心概念

1. **X-Project-ID**: 项目标识符（如 `memobox`），在管理后台创建。
2. **API Key**: 设备的公开标识，注册时返回。
3. **Secret Key**: 设备的私有密钥，注册时返回，**严禁传输**，仅用于本地生成签名。
4. **Device ID**: 设备的唯一硬件标识（UUID）。

### 认证流程

1. **设备注册** (首次启动)
   - 客户端生成 `device_id`
   - 调用 `/api/v1/auth/register`
   - 服务器返回 `api_key` 和 `secret_key`
   - 客户端本地安全存储这两个 Key

2. **后续请求** (事件上报等)
   - 客户端使用 `secret_key` 对请求进行签名
   - 请求头携带签名和API Key
   - 服务器验证签名

### 签名算法

签名生成步骤如下：

1. **准备参数**:
   - `method`: HTTP方法 (如 "POST")
   - `path`: 请求路径 (如 "/api/v1/events")
   - `timestamp`: 当前时间戳 (毫秒)
   - `deviceId`: 设备ID
   - `userId`: 用户ID (可选，无则留空字符串)
   - `body`: 请求体 JSON 字符串 (无则为空字符串)
   - `secretKey`: 注册时获得的密钥

2. **拼接字符串**:
   使用换行符 `\n` 连接各字段：
   ```
   data = method + "\n" + path + "\n" + timestamp + "\n" + deviceId + "\n" + userId + "\n" + body
   ```

3. **HMAC计算**:
   使用 `HmacSHA256` 算法，用 `secretKey` 对 `data` 进行加密，输出 **Base64** 字符串。

4. **请求头设置**:
   ```http
   X-Project-ID: <project_id>
   X-API-Key: <api_key>
   X-Device-ID: <device_id>
   X-User-ID: <user_id>
   X-Timestamp: <timestamp>
   X-Signature: <signature>
   ```

---

## 接口详情

### 1. 设备注册

用于新设备接入，获取通信凭证。不需要签名认证，但需要 `X-Project-ID`。

- **URL**: `/api/v1/auth/register`
- **Method**: `POST`
- **Headers**:
  - `X-Project-ID`: (必填) 项目ID

**请求体**:
```json
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_model": "iPhone 14 Pro",
  "os_version": "iOS 16.5",
  "app_version": "1.0.0"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "api_key": "api_live_xxxxxxxx",
    "secret_key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "is_new": true
  }
}
```
> ⚠️ **注意**: 请务必安全保存 `secret_key`，丢失无法找回！

### 2. 事件上报

上报用户行为事件。需要完整签名认证。

- **URL**: `/api/v1/events`
- **Method**: `POST`
- **Headers**: 需包含所有认证头

**请求体**:
```json
{
  "event_type": "button_click",
  "properties": {
    "page": "home",
    "button": "signup"
  }
}
```

### 3. 会话上报

上报用户会话信息（时长、PV等）。

- **URL**: `/api/v1/sessions`
- **Method**: `POST`

**请求体**:
```json
{
  "session_id": "uuid-xxx",
  "start_time": "2024-01-01T10:00:00Z",
  "duration_ms": 120000,
  "event_count": 5
}
```

---

## 客户端实现示例

### Node.js 示例

```javascript
const crypto = require('crypto');

function generateSignature(method, path, timestamp, deviceId, userId, body, secretKey) {
    // 注意：使用 \n 分隔各个字段
    const data = `${method}\n${path}\n${timestamp}\n${deviceId}\n${userId}\n${body}`;
    return crypto.createHmac('sha256', secretKey)
        .update(data)
        .digest('base64');
}

// 使用示例
const timestamp = Date.now().toString();
const body = JSON.stringify({ event_type: 'test' });
const signature = generateSignature(
    'POST', 
    '/api/v1/events', 
    timestamp, 
    'device-123', 
    'user-456', 
    body, 
    'my-secret-key'
);
```

### Swift 示例

```swift
import CryptoKit

func generateSignature(method: String, path: String, timestamp: String, deviceId: String, userId: String, body: String, secretKey: String) -> String {
    // 注意：使用 \n 分隔各个字段
    let data = "\(method)\n\(path)\n\(timestamp)\n\(deviceId)\n\(userId)\n\(body)"
    let key = SymmetricKey(data: secretKey.data(using: .utf8)!)
    let signature = HMAC<SHA256>.authenticationCode(for: data.data(using: .utf8)!, using: key)
    return Data(signature).base64EncodedString()
}
```

### Kotlin (Android) 示例

```kotlin
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.util.Base64

fun generateSignature(method: String, path: String, timestamp: String, deviceId: String, userId: String, body: String, secretKey: String): String {
    // 注意：使用 \n 分隔各个字段
    val data = "$method\n$path\n$timestamp\n$deviceId\n$userId\n$body"
    val hmacSha256 = "HmacSHA256"
    val secretKeySpec = SecretKeySpec(secretKey.toByteArray(), hmacSha256)
    val mac = Mac.getInstance(hmacSha256)
    mac.init(secretKeySpec)
    val bytes = mac.doFinal(data.toByteArray())
    return Base64.getEncoder().encodeToString(bytes)
}
```
