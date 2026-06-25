/// <reference types="bun" />

import colorize from './colorize';

type InspectorFn = (primitive: any) => string;

/**
 * @description A scoped, colorized console logger that prefixes every line with its caller chain and tints output
 * per log level.
 */
class Logger {
	private static inspector: InspectorFn | null = null;

	private caller: string[];

	/**
	 * @description Creates a logger whose prefix is the joined caller chain, ensuring the inspector is set up.
	 * @param callers The scope names forming the logger's prefix (e.g. `'Scope', 'SubScope'`).
	 */
	constructor(...callers: string[]) {
		this.caller = callers;

		if (typeof process !== 'undefined' && process.versions?.node) {
			try {
				const { inspect } = require('node:util');
				Logger.inspector = inspect;
			} catch {
				// Not in Node environment, allow the user to set it through `Logger.setInspector()`.
			}
		}
	}

	/**
	 * @description Creates a new logger for the given caller chain.
	 * @param callers The scope names forming the logger's prefix.
	 * @returns A new {@link Logger}.
	 */
	static create(...callers: string[]) {
		return new Logger(...callers);
	}

	/**
	 * @description Initialises the value inspector once, using Node's `util.inspect` when running under Node.
	 */
	static setInspector(inspector: InspectorFn | null) {
		Logger.inspector = inspector;
	}

	private _inspect(arg: any): string {
		if (typeof arg === 'string') return arg;
		return Logger.inspector ? Logger.inspector(arg) : JSON.stringify(arg);
	}

	/**
	 * @description Prints a blank line to the console.
	 */
	newLine() {
		console.log('');
	}

	/**
	 * @description Logs args at the `log` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	log(...args: any[]) {
		console.log(
			'»',
			this._getPrefix('log'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('log'))),
		);
	}

	/**
	 * @description Logs args at the `error` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	error(...args: any[]) {
		console.error(
			'»',
			this._getPrefix('error'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('error'))),
		);
	}

	/**
	 * @description Logs args at the `success` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	success(...args: any[]) {
		console.info(
			'»',
			this._getPrefix('success'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('success'))),
		);
	}

	/**
	 * @description Logs args at the `warn` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	warn(...args: any[]) {
		console.warn(
			'»',
			this._getPrefix('warn'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('warn'))),
		);
	}

	/**
	 * @description Logs args at the `debug` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	debug(...args: any[]) {
		console.debug(
			'»',
			this._getPrefix('debug'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('debug'))),
		);
	}

	/**
	 * @description Logs args at the `info` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	info(...args: any[]) {
		console.info(
			'»',
			this._getPrefix('info'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('info'))),
		);
	}

	/**
	 * @description Builds the bold, colorized caller-chain prefix for a log line.
	 * @param type The log level whose color to apply.
	 * @returns The colorized prefix string.
	 */
	_getPrefix(type: 'log' | 'error' | 'success' | 'warn' | 'debug' | 'info') {
		return colorize(colorize(`[${this.caller.join(' → ')}]`, this._getColor(type)), 'bold');
	}

	/**
	 * @description Maps a log level to its display color.
	 * @param type The log level.
	 * @returns The ANSI color name for the level.
	 */
	_getColor(type: 'log' | 'error' | 'success' | 'warn' | 'debug' | 'info') {
		switch (type) {
			case 'log':
				return 'gray';
			case 'error':
				return 'red';
			case 'success':
				return 'green';
			case 'warn':
				return 'yellow';
			case 'debug':
				return 'gray';
			case 'info':
				return 'cyan';
		}
	}
}

/**
 * @description Creates a scoped logger for the given caller chain.
 * @param callers The scope names forming the logger's prefix (e.g. `'Scope', 'SubScope'`).
 * @returns A new {@link Logger}.
 */
export function createLogger(...callers: string[]) {
	return new Logger(...callers);
}

export default Logger;
