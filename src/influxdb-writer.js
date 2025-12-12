const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const config = require('./config');
const logger = require('./logger');

/**
 * InfluxDB Writer Service
 * Handles writing sensor data to InfluxDB with batching
 */
class InfluxDBWriter {
    constructor() {
        this.client = null;
        this.writeApi = null;
        this.isConnected = false;
        this.buffer = [];
    }

    /**
     * Initialize InfluxDB connection
     */
    async connect() {
        try {
            logger.info('Connecting to InfluxDB...', {
                url: config.influxdb.url,
                org: config.influxdb.org,
                bucket: config.influxdb.bucket,
            });

            this.client = new InfluxDB({
                url: config.influxdb.url,
                token: config.influxdb.token,
            });

            // Create write API with batching
            this.writeApi = this.client.getWriteApi(
                config.influxdb.org,
                config.influxdb.bucket,
                'ms' // millisecond precision
            );

            // Configure batching
            this.writeApi.useDefaultTags({ source: 'mqtt-sensor' });

            this.isConnected = true;
            logger.info('Successfully connected to InfluxDB');

            // Set up periodic flush
            this.startBatchFlush();

            return true;
        } catch (error) {
            logger.error('Failed to connect to InfluxDB', {
                error: error.message,
                stack: error.stack,
            });
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Write sensor data point to InfluxDB
     * @param {Object} data - Validated sensor data
     * @param {Object} tags - Optional tags (sensor_id, location, etc.)
     */
    async writeData(data, tags = {}) {
        if (!this.isConnected || !this.writeApi) {
            logger.warn('InfluxDB not connected, buffering data', { bufferSize: this.buffer.length });
            this.buffer.push({ data, tags, timestamp: Date.now() });
            return false;
        }

        try {
            // Create point with measurement name
            const point = new Point('environmental_sensors')
                .floatField('temperature', data.temperature)
                .floatField('humidity', data.humidity)
                .intField('pm1', data.pm1)
                .intField('pm2_5', data.pm2_5)
                .intField('pm10', data.pm10);

            // Add optional tags
            if (tags.sensor_id) point.tag('sensor_id', tags.sensor_id);
            if (tags.location) point.tag('location', tags.location);
            if (tags.device_type) point.tag('device_type', tags.device_type);

            // Write point
            this.writeApi.writePoint(point);

            logger.debug('Data point written to InfluxDB', { data, tags });
            return true;
        } catch (error) {
            logger.error('Failed to write data to InfluxDB', {
                error: error.message,
                data,
            });
            return false;
        }
    }

    /**
     * Start periodic batch flush
     */
    startBatchFlush() {
        setInterval(async () => {
            if (this.writeApi) {
                try {
                    await this.writeApi.flush();
                    logger.debug('InfluxDB batch flushed');

                    // Write buffered data if reconnected
                    if (this.buffer.length > 0 && this.isConnected) {
                        logger.info(`Writing ${this.buffer.length} buffered points`);
                        for (const item of this.buffer) {
                            await this.writeData(item.data, item.tags);
                        }
                        this.buffer = [];
                    }
                } catch (error) {
                    logger.error('Failed to flush InfluxDB batch', { error: error.message });
                }
            }
        }, config.batch.interval);
    }

    /**
     * Query data from InfluxDB
     * @param {string} range - Time range (e.g., '-1h', '-24h')
     * @returns {Promise<Array>}
     */
    async queryData(range = '-1h') {
        if (!this.isConnected || !this.client) {
            logger.error('Cannot query: InfluxDB not connected');
            return [];
        }

        try {
            const queryApi = this.client.getQueryApi(config.influxdb.org);

            const query = `
        from(bucket: "${config.influxdb.bucket}")
          |> range(start: ${range})
          |> filter(fn: (r) => r._measurement == "environmental_sensors")
      `;

            const results = [];

            return new Promise((resolve, reject) => {
                queryApi.queryRows(query, {
                    next(row, tableMeta) {
                        const record = tableMeta.toObject(row);
                        results.push(record);
                    },
                    error(error) {
                        logger.error('Query error', { error: error.message });
                        reject(error);
                    },
                    complete() {
                        logger.info('Query completed', { rowCount: results.length });
                        resolve(results);
                    },
                });
            });
        } catch (error) {
            logger.error('Failed to query data', { error: error.message });
            return [];
        }
    }

    /**
     * Close InfluxDB connection
     */
    async close() {
        try {
            if (this.writeApi) {
                await this.writeApi.close();
                logger.info('InfluxDB connection closed');
            }
            this.isConnected = false;
        } catch (error) {
            logger.error('Error closing InfluxDB connection', { error: error.message });
        }
    }
}

module.exports = new InfluxDBWriter();
