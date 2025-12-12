# คู่มือการใช้งาน InfluxDB API

## 📋 ข้อมูลการเชื่อมต่อ

- **Base URL:** `http://172.16.116.82:8086`
- **Organization:** `iot_monitoring`
- **Bucket:** `sensor_data`
- **Token:** `my-super-secret-admin-token-change-me`
- **Measurement:** `environmental_sensors`
- **Fields:** `temperature`, `humidity`, `pm1`, `pm2_5`, `pm10`

---

## 🔍 วิธีการ Query ข้อมูล

### วิธีที่ 1: ใช้ HTTP API โดยตรง (แนะนำ)

#### ใช้ curl

```bash
curl -X POST "http://172.16.116.82:8086/api/v2/query?org=iot_monitoring" \
  -H "Authorization: Token my-super-secret-admin-token-change-me" \
  -H "Content-Type: application/vnd.flux" \
  -H "Accept: application/csv" \
  -d 'from(bucket:"sensor_data")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "environmental_sensors")'
```

#### ใช้ JavaScript/Node.js

```javascript
const axios = require('axios');

async function queryInfluxDB() {
  const query = `
    from(bucket:"sensor_data")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "environmental_sensors")
  `;

  const response = await axios.post(
    'http://172.16.116.82:8086/api/v2/query?org=iot_monitoring',
    query,
    {
      headers: {
        'Authorization': 'Token my-super-secret-admin-token-change-me',
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/json'
      }
    }
  );

  return response.data;
}
```

#### ใช้ Python

```python
import requests

def query_influxdb():
    url = "http://172.16.116.82:8086/api/v2/query?org=iot_monitoring"
    
    headers = {
        "Authorization": "Token my-super-secret-admin-token-change-me",
        "Content-Type": "application/vnd.flux",
        "Accept": "application/json"
    }
    
    query = """
    from(bucket:"sensor_data")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "environmental_sensors")
    """
    
    response = requests.post(url, headers=headers, data=query)
    return response.json()
```

### วิธีที่ 2: ใช้ Function ที่มีในระบบ

```javascript
const influxDBWriter = require('./influxdb-writer');

// ดึงข้อมูล 1 ชั่วโมงย้อนหลัง
const data = await influxDBWriter.queryData('-1h');

// ดึงข้อมูล 24 ชั่วโมงย้อนหลัง
const data = await influxDBWriter.queryData('-24h');

// ดึงข้อมูล 7 วันย้อนหลัง
const data = await influxDBWriter.queryData('-7d');
```

---

## 📊 ตัวอย่าง Query ที่ใช้บ่อย

### 1. ดึงค่าอุณหภูมิล่าสุด

```flux
from(bucket:"sensor_data")
  |> range(start: -1m)
  |> filter(fn: (r) => r._measurement == "environmental_sensors")
  |> filter(fn: (r) => r._field == "temperature")
  |> last()
```

### 2. ดึงข้อมูลทั้งหมดจาก 1 ชั่วโมงที่ผ่านมา

```flux
from(bucket:"sensor_data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "environmental_sensors")
```

### 3. คำนวณค่าเฉลี่ย PM2.5 ใน 1 ชั่วโมง

```flux
from(bucket:"sensor_data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "environmental_sensors")
  |> filter(fn: (r) => r._field == "pm2_5")
  |> mean()
```

### 4. ดึงข้อมูลตามช่วงเวลาที่กำหนด

```flux
from(bucket:"sensor_data")
  |> range(start: 2025-12-12T00:00:00Z, stop: 2025-12-12T23:59:59Z)
  |> filter(fn: (r) => r._measurement == "environmental_sensors")
```

### 5. ดึงข้อมูลล่าสุด 10 รายการ

```flux
from(bucket:"sensor_data")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "environmental_sensors")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 10)
```

### 6. ดึงเฉพาะ PM2.5 และ PM10

```flux
from(bucket:"sensor_data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "environmental_sensors")
  |> filter(fn: (r) => r._field == "pm2_5" or r._field == "pm10")
```

### 7. คำนวณค่าสูงสุด, ต่ำสุด, เฉลี่ย

```flux
from(bucket:"sensor_data")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "environmental_sensors")
  |> filter(fn: (r) => r._field == "temperature")
  |> aggregateWindow(every: 1h, fn: mean)
```

---

## ✅ ทดสอบการเชื่อมต่อ

### ทดสอบด้วย curl

```bash
curl -X POST "http://172.16.116.82:8086/api/v2/query?org=iot_monitoring" \
  -H "Authorization: Token my-super-secret-admin-token-change-me" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket:"sensor_data") |> range(start: -1h) |> limit(n:5)'
```

### ตรวจสอบสถานะ InfluxDB

```bash
curl -X GET "http://172.16.116.82:8086/health"
```

---

## 🎯 Time Range Format

| Format | คำอธิบาย |
|--------|----------|
| `-1m` | 1 นาทีย้อนหลัง |
| `-1h` | 1 ชั่วโมงย้อนหลัง |
| `-24h` | 24 ชั่วโมงย้อนหลัง |
| `-7d` | 7 วันย้อนหลัง |
| `-1w` | 1 สัปดาห์ย้อนหลัง |
| `2025-12-12T00:00:00Z` | เวลาที่กำหนดเอง (UTC) |

## 📝 Response Format

### CSV Format

```bash
-H "Accept: application/csv"
```

### JSON Format

```bash
-H "Accept: application/json"
```