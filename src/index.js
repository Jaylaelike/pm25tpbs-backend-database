const http = require('http');
const config = require('./config');
const logger = require('./logger');
const MQTTClient = require('./mqtt-client');
const WebSocketClient = require('./websocket-client');
const influxDBWriter = require('./influxdb-writer');

/**
 * Main application
 */
class Application {
    constructor() {
        this.dataClient = null;
        this.httpServer = null;
        this.isRunning = false;
        this.dataPointCount = 0;
        this.useMQTT = true;
    }

    /**
     * Initialize and start the application
     */
    async start() {
        try {
            logger.info('Starting IoT Monitoring System...', {
                env: config.app.env,
                version: require('../package.json').version,
            });

            // Connect to InfluxDB
            const influxConnected = await influxDBWriter.connect();
            if (!influxConnected) {
                logger.error('Failed to connect to InfluxDB, will retry on data arrival');
            }

            // Start data collection client (MQTT or WebSocket)
            this.startDataClient();

            // Start HTTP health check server
            this.startHealthCheckServer();

            this.isRunning = true;
            logger.info('IoT Monitoring System started successfully');
        } catch (error) {
            logger.error('Failed to start application', {
                error: error.message,
                stack: error.stack,
            });
            process.exit(1);
        }
    }

    /**
     * Start data collection client (MQTT with WebSocket fallback)
     */
    startDataClient() {
        // Try MQTT first
        logger.info('Attempting to connect via MQTT...');
        this.dataClient = new MQTTClient();
        this.useMQTT = true;

        // Set up data handler
        this.dataClient.on('data', (data) => this.handleSensorData(data));

        // Set up error handler for fallback
        this.dataClient.on('error', (error) => {
            logger.error('MQTT error occurred', { error: error.message });

            // If MQTT fails, try WebSocket fallback after a delay
            if (this.useMQTT) {
                setTimeout(() => {
                    if (!this.dataClient.connected()) {
                        logger.warn('MQTT connection failed, switching to WebSocket fallback');
                        this.switchToWebSocket();
                    }
                }, 5000);
            }
        });

        // Connect
        this.dataClient.connect();
    }

    /**
     * Switch to WebSocket fallback
     */
    switchToWebSocket() {
        // Disconnect MQTT if connected
        if (this.dataClient && this.useMQTT) {
            this.dataClient.disconnect();
            this.dataClient.removeAllListeners();
        }

        logger.info('Switching to WebSocket client...');
        this.dataClient = new WebSocketClient();
        this.useMQTT = false;

        // Set up data handler
        this.dataClient.on('data', (data) => this.handleSensorData(data));

        // Set up error handler
        this.dataClient.on('error', (error) => {
            logger.error('WebSocket error', { error: error.message });
        });

        this.dataClient.on('failed', () => {
            logger.error('WebSocket connection failed permanently');
            // Optionally try to reconnect to MQTT
            setTimeout(() => {
                logger.info('Attempting to reconnect to MQTT...');
                this.startDataClient();
            }, 10000);
        });

        // Connect
        this.dataClient.connect();
    }

    /**
     * Handle incoming sensor data
     * @param {Object} data - Validated sensor data
     */
    async handleSensorData(data) {
        try {
            this.dataPointCount++;

            logger.info('Processing sensor data', {
                dataPoint: this.dataPointCount,
                data,
            });

            // Write to InfluxDB
            const success = await influxDBWriter.writeData(data, {
                sensor_id: 'sensor-001', // You can make this dynamic
                location: 'default',
                device_type: 'environmental',
            });

            if (success) {
                logger.debug('Data successfully written to InfluxDB', {
                    dataPoint: this.dataPointCount,
                });
            } else {
                logger.warn('Failed to write data to InfluxDB', {
                    dataPoint: this.dataPointCount,
                });
            }
        } catch (error) {
            logger.error('Error handling sensor data', {
                error: error.message,
                data,
            });
        }
    }

    /**
     * Start HTTP server for health checks
     */
    startHealthCheckServer() {
        this.httpServer = http.createServer((req, res) => {
            if (req.url === '/health' && req.method === 'GET') {
                const healthStatus = {
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    dataPointsCollected: this.dataPointCount,
                    dataClient: {
                        type: this.useMQTT ? 'MQTT' : 'WebSocket',
                        connected: this.dataClient ? this.dataClient.connected() : false,
                    },
                    influxdb: {
                        connected: influxDBWriter.isConnected,
                    },
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(healthStatus, null, 2));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        });

        this.httpServer.listen(config.app.port, () => {
            logger.info('Health check server started', {
                port: config.app.port,
                endpoint: `http://localhost:${config.app.port}/health`,
            });
        });
    }

    /**
     * Gracefully shutdown the application
     */
    async shutdown() {
        logger.info('Shutting down IoT Monitoring System...');

        this.isRunning = false;

        // Close data client
        if (this.dataClient) {
            this.dataClient.disconnect();
        }

        // Close InfluxDB connection
        await influxDBWriter.close();

        // Close HTTP server
        if (this.httpServer) {
            this.httpServer.close(() => {
                logger.info('HTTP server closed');
            });
        }

        logger.info('Shutdown complete');
        process.exit(0);
    }
}

// Create and start application
const app = new Application();

// Handle shutdown signals
process.on('SIGINT', () => {
    logger.info('Received SIGINT signal');
    app.shutdown();
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal');
    app.shutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
    });
    app.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', {
        reason,
        promise,
    });
});

// Start the application
app.start();
