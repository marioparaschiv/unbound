import colorize from './colorize';

class Logger {
	private static inspectFn: ((primitive: any) => string) | null = null;
	private static inspectorInitialized = false;

	private caller: string[];

	constructor(...callers: string[]) {
		this.caller = callers;
		Logger.setInspector();
	}

	static create(...callers: string[]) {
		return new Logger(...callers);
	}

	static setInspector() {
		if (Logger.inspectorInitialized) return;
		Logger.inspectorInitialized = true;

		if (typeof process !== 'undefined' && process.versions?.node) {
			try {
				const nodeUtil = require('node:util');
				Logger.inspectFn = nodeUtil.inspect;
			} catch {
				// Not in Node environment
			}
		}
	}

	private _inspect(arg: any): string {
		if (typeof arg === 'string') return arg;
		return Logger.inspectFn ? Logger.inspectFn(arg) : JSON.stringify(arg);
	}

	newLine() {
		console.log('');
	}

	log(...args: any[]) {
		console.log(
			'»',
			this._getPrefix('log'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('log'))),
		);
	}

	error(...args: any[]) {
		console.error(
			'»',
			this._getPrefix('error'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('error'))),
		);
	}

	success(...args: any[]) {
		console.info(
			'»',
			this._getPrefix('success'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('success'))),
		);
	}

	warn(...args: any[]) {
		console.warn(
			'»',
			this._getPrefix('warn'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('warn'))),
		);
	}

	debug(...args: any[]) {
		console.debug(
			'»',
			this._getPrefix('debug'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('debug'))),
		);
	}

	info(...args: any[]) {
		console.info(
			'»',
			this._getPrefix('info'),
			...args.map((arg) => colorize(this._inspect(arg), this._getColor('info'))),
		);
	}

	_getPrefix(type: 'log' | 'error' | 'success' | 'warn' | 'debug' | 'info') {
		return colorize(colorize(`[${this.caller.join(' → ')}]`, this._getColor(type)), 'bold');
	}

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

export function createLogger(...callers: string[]) {
	return new Logger(...callers);
}

export default Logger;
