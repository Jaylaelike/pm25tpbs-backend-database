const WebSocket = require('ws');
const EventEmitter = require('events');
const config = require('./config');
const logger = require('./logger');
const dataValidator = require('./data-validator');

/**
 * WebSocket Client for sensor data collection (fallback)
 */
class WebSocketClient extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.maxReconnectAttempts = config.websocket.options.maxReconnectAttempts;
        this.reconnectInterval = config.websocket.options.reconnectInterval;
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        try {
            logger.info('Connecting to WebSocket server...', {
                url: config.websocket.url,
            });

            this.ws = new WebSocket(config.websocket.url);

            // Set up event handlers
            this.setupEventHandlers();

            return this.ws;
        } catch (error) {
            logger.error('Failed to create WebSocket client', {
                error: error.message,
                stack: error.stack,
            });
            this.emit('error', error);
            this.scheduleReconnect();
            return null;
        }
    }

    /**
     * Set up WebSocket event handlers
     */
    setupEventHandlers() {
        // Connection opened
        this.ws.on('open', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger.info('Connected to WebSocket server successfully');

            // Subscribe to sensor topic (MQTT over WebSocket)
            const subscribeMessage = JSON.stringify({
                action: 'subscribe',
                topic: config.mqtt.topic,
            });
            this.ws.send(subscribeMessage);

            this.emit('connected');
        });

        // Message received
        this.ws.on('message', (data) => {
            this.handleMessage(data);
        });

        // Connection error
        this.ws.on('error', (error) => {
            logger.error('WebSocket error', { error: error.message });
            this.isConnected = false;
            this.emit('error', error);
        });

        // Connection closed
        this.ws.on('close', (code, reason) => {
            this.isConnected = false;
            logger.warn('WebSocket connection closed', {
                code,
                reason: reason.toString(),
            });
            this.emit('disconnected');
            this.scheduleReconnect();
        });
    }

    /**
     * Handle incoming WebSocket message
     * @param {Buffer|string} data 
     */
    handleMessage(data) {
        try {
            const messageStr = data.toString();
            logger.debug('Received WebSocket message', { message: messageStr });

            // Parse JSON message
            const message = dataValidator.parseJSON(messageStr);
            if (!message) {
                logger.error('Failed to parse message as JSON', { message: messageStr });
                return;
            }

            // Extract sensor data (might be wrapped in MQTT message structure)
            let sensorData = message;
            if (message.payload) {
                sensorData = typeof message.payload === 'string'
                    ? dataValidator.parseJSON(message.payload)
                    : message.payload;
            }

            // Validate data
            const validation = dataValidator.validate(sensorData);
            if (!validation.valid) {
                logger.warn('Invalid sensor data received', {
                    errors: validation.errors,
                    data: sensorData,
                });
                return;
            }

            // Emit validated data
            this.emit('data', validation.data);

            logger.info('Valid sensor data received', { data: validation.data });
        } catch (error) {
            logger.error('Error handling WebSocket message', {
                error: error.message,
            });
        }
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnect attempts reached, giving up', {
                attempts: this.reconnectAttempts,
            });
            this.emit('failed');
            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectAttempts++;
        logger.info('Scheduling WebSocket reconnect', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            delay: this.reconnectInterval,
        });

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, this.reconnectInterval);
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            logger.info('Disconnected from WebSocket server');
            this.isConnected = false;
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

module.exports = WebSocketClient;
