# IoT Environmental Monitoring System

A real-time IoT monitoring system that collects environmental sensor data (temperature, humidity, PM levels) via MQTT/WebSocket, stores it in InfluxDB time-series database, and visualizes it through Grafana dashboards.

## 🏗️ Architecture

```
Sensor Device → MQTT Broker/WebSocket → Node.js Server → InfluxDB → Grafana
     (172.16.202.63)                    (Port 3001)     (Port 8086)  (Port 3002)
```

## 📋 Features

- **Dual Protocol Support**: MQTT primary with WebSocket fallback
- **Real-time Data Processing**: Automatic data validation and normalization
- **Time-Series Storage**: InfluxDB for efficient sensor data storage
- **Interactive Dashboards**: Grafana visualization with auto-refresh
- **Containerized Deployment**: Docker Compose orchestration
- **Health Monitoring**: Built-in health check endpoints
- **Automatic Reconnection**: Resilient connection handling
- **Data Buffering**: No data loss during network issues

## 📊 Monitored Metrics

- **Temperature** (°C)
- **Humidity** (%)
- **PM1.0** (μg/m³)
- **PM2.5** (μg/m³)
- **PM10** (μg/m³)

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Access to MQTT broker at 172.16.202.63:1883
- Minimum 2GB RAM available

### Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd /Users/user/Desktop/pm25tpbs-backend
   ```

2. **Review and update environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env if needed (optional)
   ```

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **Check service health:**
   ```bash
   docker-compose ps
   ```

### Accessing Services

- **Node.js Health Check**: http://localhost:3001/health
- **InfluxDB UI**: http://localhost:8086
  - Username: `admin`
  - Password: `adminpassword123`
- **Grafana Dashboard**: http://localhost:3002
  - Username: `admin`
  - Password: `admin`

## 📁 Project Structure

```
pm25tpbs-backend/
├── docker-compose.yml          # Service orchestration
├── Dockerfile                  # Node.js app container
├── package.json               # Node.js dependencies
├── .env                       # Environment variables
├── .env.example              # Environment template
├── src/
│   ├── index.js              # Main application
│   ├── config.js             # Configuration management
│   ├── logger.js             # Winston logger
│   ├── mqtt-client.js        # MQTT connection handler
│   ├── websocket-client.js   # WebSocket fallback
│   ├── influxdb-writer.js    # InfluxDB integration
│   └── data-validator.js     # Data validation service
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/      # Auto-configured data sources
│   │   └── dashboards/       # Dashboard provisioning
│   └── dashboards/
│       └── environmental-monitoring.json  # Main dashboard
└── logs/                     # Application logs
```

## ⚙️ Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# MQTT Configuration
MQTT_HOST=172.16.202.63
MQTT_PORT=1883
MQTT_USERNAME=              # Empty for anonymous
MQTT_PASSWORD=public
MQTT_TOPIC=sensor/data

# WebSocket Fallback
WS_URL=ws://172.16.202.63:8083/mqtt

# InfluxDB Configuration
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=my-super-secret-admin-token-change-me
INFLUXDB_ORG=iot_monitoring
INFLUXDB_BUCKET=sensor_data

# Application Settings
NODE_ENV=production
LOG_LEVEL=info
PORT=3001
```

### Expected Data Format

The system expects JSON messages on the MQTT topic:

```json
{
  "temperature": 26.9,
  "humidity": 81.8,
  "pm1": 24,
  "pm2_5": 35,
  "pm10": 37
}
```

## 🔍 Monitoring & Debugging

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f nodejs-app
docker-compose logs -f influxdb
docker-compose logs -f grafana

# Application logs (on host)
tail -f logs/combined.log
tail -f logs/error.log
```

### Health Checks

```bash
# Node.js application
curl http://localhost:3001/health

# InfluxDB
docker exec -it iot-influxdb influx ping

# Grafana
curl http://localhost:3002/api/health
```

### Query InfluxDB Data

```bash
# Enter InfluxDB container
docker exec -it iot-influxdb influx

# Query recent data
> from(bucket:"sensor_data") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "environmental_sensors")
```

## 🛠️ Troubleshooting

### MQTT Connection Issues

**Problem**: Cannot connect to MQTT broker

**Solutions**:
1. Verify network connectivity: `ping 172.16.202.63`
2. Check MQTT broker is running on port 1883
3. Verify credentials in `.env`
4. System will automatically fall back to WebSocket

### InfluxDB Connection Failed

**Problem**: Node.js app cannot write to InfluxDB

**Solutions**:
1. Check InfluxDB container is healthy: `docker ps`
2. Verify token matches in `.env` and `docker-compose.yml`
3. Data will be buffered and written when connection restored

### Grafana Shows No Data

**Problem**: Dashboard panels are empty

**Solutions**:
1. Verify MQTT/WebSocket is receiving data (check logs)
2. Confirm InfluxDB has data: Use InfluxDB UI at http://localhost:8086
3. Check data source configuration in Grafana
4. Verify bucket name matches: `sensor_data`

### Container Won't Start

**Problem**: Docker container fails to start

**Solutions**:
```bash
# Remove and recreate containers
docker-compose down
docker-compose up -d --force-recreate

# Check for port conflicts
lsof -i :3001
lsof -i :3002
lsof -i :8086
```

## 🔄 Maintenance Commands

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### Update Application Code
```bash
docker-compose down
docker-compose up -d --build nodejs-app
```

### Clean Everything (⚠️ Deletes all data)
```bash
docker-compose down -v
```

### Backup InfluxDB Data
```bash
docker exec iot-influxdb influx backup /tmp/backup
docker cp iot-influxdb:/tmp/backup ./influxdb-backup
```

## 📈 Grafana Dashboard

The pre-configured dashboard includes:

1. **Temperature Panel**: Real-time temperature graph with current value
2. **Humidity Panel**: Real-time humidity graph with current value
3. **Air Quality Panel**: Multi-line chart for PM1, PM2.5, PM10
4. **Statistics Panel**: Average values over the last hour
5. **PM2.5 Gauge**: Current air quality indicator with color-coded thresholds

**Color Coding**:
- 🟢 Green: Good (0-50 μg/m³)
- 🟡 Yellow: Moderate (50-100 μg/m³)
- 🟠 Orange: Unhealthy (100-150 μg/m³)
- 🔴 Red: Hazardous (>150 μg/m³)

## 🔐 Security Notes

**For Production Deployment**:

1. Change default passwords in `docker-compose.yml`:
   - InfluxDB admin password
   - Grafana admin password

2. Update InfluxDB token in `.env`:
   ```bash
   INFLUXDB_TOKEN=<generate-strong-token>
   ```

3. Consider using Docker secrets for sensitive data

4. Enable HTTPS/TLS for external access

## 📝 API Documentation

### Health Check Endpoint

**GET** `http://localhost:3001/health`

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-12T03:06:56.000Z",
  "uptime": 120.5,
  "dataPointsCollected": 45,
  "dataClient": {
    "type": "MQTT",
    "connected": true
  },
  "influxdb": {
    "connected": true
  }
}
```

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT

---

**Built with**: Node.js, MQTT.js, InfluxDB, Grafana, Docker
