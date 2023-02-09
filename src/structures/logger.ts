import colorize from '@utilities/colorize';

export function log(...args: string[]): void {
  return console.log('»', ...args);
}

export function error(...args: string[]): void {
  return console.error('»', ...args);
}

export function success(...args: string[]): void {
  return console.log('»', ...args);
}

export function warn(...args: string[]): void {
  return console.warn('»', ...args);
}

export function debug(...args: string[]): void {
  return console.debug('»', ...args);
}

export function info(...args: string[]): void {
  return console.info('»', ...args);
}

export function createLogger(...callers: string[]) {
  const prefix = callers.join(' → ') + ':';

  return {
    log: (...args) => log(prefix, ...args),
    error: (...args) => error(prefix, ...args),
    success: (...args) => success(prefix, ...args),
    warn: (...args) => warn(prefix, ...args),
    debug: (...args) => debug(prefix, ...args),
    info: (...args) => info(prefix, ...args),
  };
}