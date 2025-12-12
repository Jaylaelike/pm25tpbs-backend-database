# Production Deployment Guide

## 🚀 Quick Start (Production)

This guide uses the pre-built Docker image from Docker Hub for production deployment.

### Prerequisites

- Docker and Docker Compose installed
- Access to MQTT broker at 172.16.202.63:1883
- Server with minimum 2GB RAM

### Deploy to Production

```bash
# Navigate to project directory
cd /Users/user/Desktop/pm25tpbs-backend

# Pull latest image from Docker Hub
docker pull jaylaelove/pm25tpbs-backend-database:latest

# Start all services in production mode
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 🔄 Restart Policies

All services are configured with `restart: always`:
- **Automatic restart** on failure
- **Start on boot** after system reboot
- **Continuous operation** 24/7

---

## 📊 Service Access

- **Grafana Dashboard**: http://localhost:3002 (admin/admin)
- **InfluxDB UI**: http://localhost:8086 (admin/adminpassword123)
- **Health Check API**: http://localhost:3001/health

---

## 🛠️ Management Commands

### Update to Latest Version

```bash
# Pull latest image
docker pull jaylaelove/pm25tpbs-backend-database:latest

# Restart with new image
docker-compose -f docker-compose.prod.yml up -d --force-recreate nodejs-app

# Or restart all services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f nodejs-app

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Check Health

```bash
# Service status
docker-compose -f docker-compose.prod.yml ps

# Health endpoint
curl http://localhost:3001/health | jq

# Container stats
docker stats
```

### Stop Services

```bash
# Stop all (data persists)
docker-compose -f docker-compose.prod.yml down

# Stop and remove volumes (⚠️ deletes all data)
docker-compose -f docker-compose.prod.yml down -v
```

---

## 🔐 Security Checklist

Before deploying to production, update these credentials:

### 1. Update InfluxDB Credentials

Edit `docker-compose.prod.yml`:

```yaml
# Line 15-17
- DOCKER_INFLUXDB_INIT_PASSWORD=<YOUR-STRONG-PASSWORD>
- DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=<YOUR-STRONG-TOKEN>
```

### 2. Update Grafana Password

Edit `docker-compose.prod.yml`:

```yaml
# Line 87
- GF_SECURITY_ADMIN_PASSWORD=<YOUR-STRONG-PASSWORD>
```

### 3. Update MQTT Credentials (if needed)

Edit `docker-compose.prod.yml`:

```yaml
# Line 45-46
- MQTT_USERNAME=<YOUR-MQTT-USERNAME>
- MQTT_PASSWORD=<YOUR-MQTT-PASSWORD>
```

---

## 📈 Monitoring

### Health Check Endpoint

The Node.js app exposes a health check endpoint:

```bash
curl http://localhost:3001/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-12T07:42:00.000Z",
  "uptime": 3600.5,
  "dataPointsCollected": 1234,
  "dataClient": {
    "type": "MQTT",
    "connected": true
  },
  "influxdb": {
    "connected": true
  }
}
```

### Set Up Monitoring Alerts

You can use tools like:
- **Uptime Kuma** - Self-hosted monitoring
- **Prometheus + Grafana** - Advanced metrics
- **Simple cron job** - Periodic health checks

Example cron job (checks every 5 minutes):
```bash
*/5 * * * * curl -f http://localhost:3001/health || echo "Service down" | mail -s "Alert" admin@example.com
```

---

## 🔄 Automatic Updates

### Using Watchtower (Optional)

Automatically pull and deploy latest images:

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  iot-nodejs-app \
  --interval 3600
```

This will check for updates every hour and automatically restart with the latest image.

---

## 💾 Backup & Restore

### Backup InfluxDB Data

```bash
# Create backup
docker exec iot-influxdb influx backup /tmp/backup -t my-super-secret-admin-token-change-me

# Copy to host
docker cp iot-influxdb:/tmp/backup ./influxdb-backup-$(date +%Y%m%d)

# Compress
tar -czf influxdb-backup-$(date +%Y%m%d).tar.gz ./influxdb-backup-$(date +%Y%m%d)
```

### Restore InfluxDB Data

```bash
# Copy backup to container
docker cp ./influxdb-backup-20251212 iot-influxdb:/tmp/restore

# Restore
docker exec iot-influxdb influx restore /tmp/restore -t my-super-secret-admin-token-change-me
```

### Backup Grafana Dashboards

```bash
# Export dashboard
curl -H "Authorization: Bearer admin:admin" \
  http://localhost:3002/api/dashboards/uid/environmental-monitoring > dashboard-backup.json
```

---

## 🌐 Reverse Proxy Setup (Nginx)

For production, use a reverse proxy with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name monitoring.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Grafana
    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_set_header Host $host;
    }
}
```

---

## 🐛 Troubleshooting

### Container Keeps Restarting

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs nodejs-app

# Check container status
docker inspect iot-nodejs-app | grep -A 10 State
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# If needed, limit resources in docker-compose.prod.yml:
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

### Data Not Persisting

```bash
# Check volumes
docker volume ls
docker volume inspect pm25tpbs-backend_influxdb-data

# Ensure volumes are properly mounted
docker-compose -f docker-compose.prod.yml config
```

---

## 📊 Performance Tuning

### Optimize InfluxDB

Add to docker-compose.prod.yml under influxdb environment:

```yaml
- INFLUXDB_DATA_CACHE_MAX_MEMORY_SIZE=1073741824  # 1GB
- INFLUXDB_DATA_CACHE_SNAPSHOT_MEMORY_SIZE=26214400  # 25MB
```

### Optimize Node.js App

```yaml
# Add under nodejs-app environment
- NODE_OPTIONS=--max-old-space-size=512
```

---

## ✅ Post-Deployment Checklist

- [ ] Services are running (`docker-compose ps` shows "Up" and "healthy")
- [ ] Health endpoint responds (`curl http://localhost:3001/health`)
- [ ] Grafana is accessible (http://localhost:3002)
- [ ] MQTT connection established (check logs)
- [ ] Data is being collected (dataPointsCollected > 0)
- [ ] Grafana dashboards show data
- [ ] Credentials changed from defaults
- [ ] Backup system configured
- [ ] Monitoring/alerts set up
- [ ] Firewall rules configured
- [ ] SSL/TLS enabled (if public)

---

## 🆘 Support

For issues or questions:
1. Check application logs: `docker-compose -f docker-compose.prod.yml logs`
2. Verify health status: `curl http://localhost:3001/health`
3. Review [README.md](README.md) for detailed documentation
4. Check [walkthrough.md](walkthrough.md) for troubleshooting guide
