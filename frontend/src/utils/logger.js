/**
 * Frontend Logger Utility
 * Provides a standardized way to log messages with levels and optional metadata.
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Default log level based on environment (development vs production)
const CURRENT_LOG_LEVEL = import.meta.env.DEV ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

const formatMessage = (level, message, data) => {
  const timestamp = new Date().toISOString();
  let logStr = `[${timestamp}] [${level}] ${message}`;
  if (data) {
    logStr += ` | Data: ${JSON.stringify(data, null, 2)}`;
  }
  return logStr;
};

const logger = {
  debug: (message, data) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
      console.debug(formatMessage('DEBUG', message, data));
    }
  },
  info: (message, data) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
      console.info(formatMessage('INFO', message, data));
    }
  },
  warn: (message, data) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, data));
    }
  },
  error: (message, data) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
      console.error(formatMessage('ERROR', message, data));
    }
  },
};

export default logger;
