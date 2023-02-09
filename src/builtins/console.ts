import { addLog } from '@stores/logger';
import { findByProps } from '@metro';

const Util = findByProps('inspect', { lazy: true });

export enum Levels {
  error = 3,
  info = 1,
  log = 1,
  warn = 2,
  trace = 0,
  debug = 0,
};

const methods = ['error', 'info', 'log', 'warn', 'trace', 'debug'];

export function initialize() {
  for (const method of methods) {
    console[method].__ORIGINAL__ = console[method];

    console[method] = (...args) => {
      const payload = [];

      for (let i = 0, len = args.length; len > i; i++) {
        payload.push(typeof args[i] === 'string' ? args[i] : Util.inspect(args[i]));
      }

      let output = '';

      for (let i = 0, len = payload.length; len > i; i++) {
        output += `${payload[i]} `;
      }

      addLog({
        message: output,
        level: Levels[method]
      });

      nativeLoggingHook(output, Levels[method] ?? Levels.info);
    };
  }
}

export function shutdown() {
  for (const method of methods) {
    const orig = console[method].__ORIGINAL__;
    if (!orig) continue;

    console[method] = orig;
  }
}

export default { initialize, shutdown };