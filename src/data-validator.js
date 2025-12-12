const logger = require('./logger');

/**
 * Validates sensor data structure and values
 */
class DataValidator {
    constructor() {
        this.requiredFields = ['temperature', 'humidity', 'pm1', 'pm2_5', 'pm10'];

        // Define reasonable ranges for validation
        this.ranges = {
            temperature: { min: -50, max: 100 }, // Celsius
            humidity: { min: 0, max: 100 }, // Percentage
            pm1: { min: 0, max: 1000 }, // μg/m³
            pm2_5: { min: 0, max: 1000 },
            pm10: { min: 0, max: 1000 },
        };
    }

    /**
     * Validates incoming sensor data
     * @param {Object} data - Raw sensor data
     * @returns {Object} - { valid: boolean, data: Object, errors: Array }
     */
    validate(data) {
        const errors = [];

        // Check if data is an object
        if (!data || typeof data !== 'object') {
            return {
                valid: false,
                data: null,
                errors: ['Data must be an object'],
            };
        }

        // Check for required fields
        const missingFields = this.requiredFields.filter(field => !(field in data));
        if (missingFields.length > 0) {
            errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Parse and validate each field
        const validatedData = {};

        // Temperature (float)
        if ('temperature' in data) {
            const temp = parseFloat(data.temperature);
            if (isNaN(temp)) {
                errors.push('Temperature must be a number');
            } else if (!this.isInRange(temp, this.ranges.temperature)) {
                errors.push(`Temperature out of range (${this.ranges.temperature.min}-${this.ranges.temperature.max})`);
            } else {
                validatedData.temperature = temp;
            }
        }

        // Humidity (float)
        if ('humidity' in data) {
            const humidity = parseFloat(data.humidity);
            if (isNaN(humidity)) {
                errors.push('Humidity must be a number');
            } else if (!this.isInRange(humidity, this.ranges.humidity)) {
                errors.push(`Humidity out of range (${this.ranges.humidity.min}-${this.ranges.humidity.max})`);
            } else {
                validatedData.humidity = humidity;
            }
        }

        // PM1 (integer)
        if ('pm1' in data) {
            const pm1 = parseInt(data.pm1, 10);
            if (isNaN(pm1)) {
                errors.push('PM1 must be a number');
            } else if (!this.isInRange(pm1, this.ranges.pm1)) {
                errors.push(`PM1 out of range (${this.ranges.pm1.min}-${this.ranges.pm1.max})`);
            } else {
                validatedData.pm1 = pm1;
            }
        }

        // PM2.5 (integer)
        if ('pm2_5' in data) {
            const pm2_5 = parseInt(data.pm2_5, 10);
            if (isNaN(pm2_5)) {
                errors.push('PM2.5 must be a number');
            } else if (!this.isInRange(pm2_5, this.ranges.pm2_5)) {
                errors.push(`PM2.5 out of range (${this.ranges.pm2_5.min}-${this.ranges.pm2_5.max})`);
            } else {
                validatedData.pm2_5 = pm2_5;
            }
        }

        // PM10 (integer)
        if ('pm10' in data) {
            const pm10 = parseInt(data.pm10, 10);
            if (isNaN(pm10)) {
                errors.push('PM10 must be a number');
            } else if (!this.isInRange(pm10, this.ranges.pm10)) {
                errors.push(`PM10 out of range (${this.ranges.pm10.min}-${this.ranges.pm10.max})`);
            } else {
                validatedData.pm10 = pm10;
            }
        }

        const valid = errors.length === 0;

        if (!valid) {
            logger.warn('Data validation failed', { errors, rawData: data });
        }

        return {
            valid,
            data: valid ? validatedData : null,
            errors,
        };
    }

    /**
     * Check if value is within range
     * @param {number} value 
     * @param {Object} range - { min, max }
     * @returns {boolean}
     */
    isInRange(value, range) {
        return value >= range.min && value <= range.max;
    }

    /**
     * Parse JSON string safely
     * @param {string} jsonString 
     * @returns {Object|null}
     */
    parseJSON(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            logger.error('Failed to parse JSON', { error: error.message, jsonString });
            return null;
        }
    }
}

module.exports = new DataValidator();
