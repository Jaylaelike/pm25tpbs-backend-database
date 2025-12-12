require('dotenv').config();

const config = {
    // InfluxDB configuration
    influxdb: {
        url: process.env.INFLUXDB_URL || 'http://influxdb:8086',
        token: process.env.INFLUXDB_TOKEN || 'my-super-secret-admin-token-change-me',
        org: process.env.INFLUXDB_ORG || 'iot_monitoring',
        bucket: process.env.INFLUXDB_BUCKET || 'sensor_data',
    },

    // MQTT configuration
    mqtt: {
        host: process.env.MQTT_HOST || '172.16.202.63',
        port: parseInt(process.env.MQTT_PORT, 10) || 1883,
        username: process.env.MQTT_USERNAME || '',
        password: process.env.MQTT_PASSWORD || 'public',
        topic: process.env.MQTT_TOPIC || 'sensor/data',
        options: {
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000,
            keepalive: 60,
        },
    },

    // WebSocket configuration (fallback)
    websocket: {
        url: process.env.WS_URL || 'ws://172.16.202.63:8083/mqtt',
        options: {
            reconnectInterval: 1000,
            maxReconnectAttempts: 10,
        },
    },

    // Application configuration
    app: {
        env: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
        port: parseInt(process.env.PORT, 10) || 3001,
    },

    // Batch configuration
    batch: {
        size: parseInt(process.env.BATCH_SIZE, 10) || 100,
        interval: parseInt(process.env.BATCH_INTERVAL, 10) || 5000, // 5 seconds
    },
};

module.exports = config;
