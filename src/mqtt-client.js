const mqtt = require('mqtt');
const EventEmitter = require('events');
const config = require('./config');
const logger = require('./logger');
const dataValidator = require('./data-validator');

/**
 * MQTT Client for sensor data collection
 */
class MQTTClient extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
    }

    /**
     * Connect to MQTT broker
     */
    connect() {
        try {
            const { host, port, username, password, options } = config.mqtt;
            const brokerUrl = `mqtt://${host}:${port}`;

            logger.info('Connecting to MQTT broker...', {
                url: brokerUrl,
                username: username || 'anonymous',
            });

            // Create MQTT client connection
            const connectionOptions = {
                ...options,
            };

            // Add credentials if provided
            if (username) {
                connectionOptions.username = username;
            }
            if (password) {
                connectionOptions.password = password;
            }

            this.client = mqtt.connect(brokerUrl, connectionOptions);

            // Set up event handlers
            this.setupEventHandlers();

            return this.client;
        } catch (error) {
            logger.error('Failed to create MQTT client', {
                error: error.message,
                stack: error.stack,
            });
            this.emit('error', error);
            return null;
        }
    }

    /**
     * Set up MQTT event handlers
     */
    setupEventHandlers() {
        // Connection successful
        this.client.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger.info('Connected to MQTT broker successfully');

            // Subscribe to sensor data topic
            this.client.subscribe(config.mqtt.topic, (err) => {
                if (err) {
                    logger.error('Failed to subscribe to topic', {
                        topic: config.mqtt.topic,
                        error: err.message,
                    });
                } else {
                    logger.info('Subscribed to topic', { topic: config.mqtt.topic });
                }
            });

            this.emit('connected');
        });

        // Message received
        this.client.on('message', (topic, message) => {
            this.handleMessage(topic, message);
        });

        // Connection error
        this.client.on('error', (error) => {
            logger.error('MQTT connection error', { error: error.message });
            this.isConnected = false;
            this.emit('error', error);
        });

        // Reconnect attempt
        this.client.on('reconnect', () => {
            this.reconnectAttempts++;
            logger.info('Attempting to reconnect to MQTT broker', {
                attempt: this.reconnectAttempts,
            });
        });

        // Connection closed
        this.client.on('close', () => {
            this.isConnected = false;
            logger.warn('MQTT connection closed');
            this.emit('disconnected');
        });

        // Offline
        this.client.on('offline', () => {
            this.isConnected = false;
            logger.warn('MQTT client offline');
        });
    }

    /**
     * Handle incoming MQTT message
     * @param {string} topic 
     * @param {Buffer} message 
     */
    handleMessage(topic, message) {
        try {
            const messageStr = message.toString();
            logger.debug('Received MQTT message', { topic, message: messageStr });

            // Parse JSON message
            const data = dataValidator.parseJSON(messageStr);
            if (!data) {
                logger.error('Failed to parse message as JSON', { message: messageStr });
                return;
            }

            // Validate data
            const validation = dataValidator.validate(data);
            if (!validation.valid) {
                logger.warn('Invalid sensor data received', {
                    errors: validation.errors,
                    data,
                });
                return;
            }

            // Emit validated data
            this.emit('data', validation.data);

            logger.info('Valid sensor data received', { data: validation.data });
        } catch (error) {
            logger.error('Error handling MQTT message', {
                error: error.message,
                topic,
            });
        }
    }

    /**
     * Disconnect from MQTT broker
     */
    disconnect() {
        if (this.client) {
            this.client.end(false, () => {
                logger.info('Disconnected from MQTT broker');
                this.isConnected = false;
            });
        }
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    connected() {
        return this.isConnected;
    }
}

module.exports = MQTTClient;
