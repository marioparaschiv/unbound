/** The log levels, lowest first. */
export const LOG_LEVELS = ['verbose', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export default LOG_LEVELS;
