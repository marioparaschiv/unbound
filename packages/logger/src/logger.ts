/// <reference types="bun" />

import colorize, { type Color } from './colorize';

// UNKNOWN: the inspector renders whatever value a caller logs.
type InspectorFn = (primitive: unknown) => string;

// Hermes/RN consoles don't render ANSI and the debugger relays lines raw, so only colorize on a TTY.
// RN's process polyfill has no `process.stdout`, which makes this false in the client.
const supportsColor =
	typeof process !== 'undefined' &&
	Boolean(process.stdout?.isTTY) &&
	process.env?.NO_COLOR === undefined &&
	process.env?.TERM !== 'dumb';

/**
 * @description A scoped console logger that prefixes every line with its caller chain, tinting
 * output per log level when the environment supports ANSI colors.
 */
function describeError(error: Error): string {
	const code = 'code' in error && typeof error.code === 'string' ? ` [${error.code}]` : '';
	const heading = `${error.name}${code}: ${error.message}`;
	const frames = error.stack?.split('\n').filter((line) => /^\s*at\s/.test(line)) ?? [];

	return [heading, ...frames].join('\n');
}

type LoggedValue =
	| Error
	| string
	| number
	| boolean
	| null
	| LoggedValue[]
	| { [key: string]: LoggedValue };

type ConsoleMethod = 'log' | 'error' | 'info' | 'warn' | 'debug';

type LevelStyle = { color: Color; write: ConsoleMethod };

// Each level's color and the console method it writes through; `success` writes as `info`.
const LEVELS = {
	log: { color: 'gray', write: 'log' },
	error: { color: 'red', write: 'error' },
	success: { color: 'green', write: 'info' },
	warn: { color: 'yellow', write: 'warn' },
	debug: { color: 'gray', write: 'debug' },
	info: { color: 'cyan', write: 'info' },
} satisfies Record<string, LevelStyle>;

type LogLevel = keyof typeof LEVELS;

function revealErrors(_key: string, value: LoggedValue) {
	return value instanceof Error ? describeError(value) : value;
}

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

	// UNKNOWN: log arguments are arbitrary caller values.
	private _inspect(arg: unknown): string {
		if (typeof arg === 'string') {
			return arg;
		}

		if (Logger.inspector) {
			return Logger.inspector(arg);
		}

		if (arg instanceof Error) {
			return describeError(arg);
		}

		return JSON.stringify(arg, revealErrors);
	}

	private _paint(string: string, color: Color): string {
		return supportsColor ? colorize(string, color) : string;
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
	log(...args: unknown[]) {
		this._write('log', args);
	}

	/**
	 * @description Logs args at the `error` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	error(...args: unknown[]) {
		this._write('error', args);
	}

	/**
	 * @description Logs args at the `success` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	success(...args: unknown[]) {
		this._write('success', args);
	}

	/**
	 * @description Logs args at the `warn` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	warn(...args: unknown[]) {
		this._write('warn', args);
	}

	/**
	 * @description Logs args at the `debug` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	debug(...args: unknown[]) {
		this._write('debug', args);
	}

	/**
	 * @description Logs args at the `info` level. Twin of the other level methods.
	 * @param args The values to log.
	 */
	info(...args: unknown[]) {
		this._write('info', args);
	}

	// UNKNOWN: log arguments are arbitrary caller values.
	private _write(level: LogLevel, args: unknown[]) {
		const { color, write } = LEVELS[level];

		console[write](
			'»',
			this._getPrefix(level),
			...args.map((arg) => this._paint(this._inspect(arg), color)),
		);
	}

	/**
	 * @description Builds the caller-chain prefix for a log line, bold and colorized when supported.
	 * @param type The log level whose color to apply.
	 * @returns The prefix string.
	 */
	_getPrefix(type: LogLevel) {
		return this._paint(
			this._paint(`[${this.caller.join(' → ')}]`, this._getColor(type)),
			'bold',
		);
	}

	/**
	 * @description Maps a log level to its display color.
	 * @param type The log level.
	 * @returns The ANSI color name for the level.
	 */
	_getColor(type: LogLevel): Color {
		return LEVELS[type].color;
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
