import { afterEach, expect, spyOn, test } from 'bun:test';

import Logger from './logger';

afterEach(() => {
	Logger.setInspector(null);
});

function loggedLine(log: (logger: Logger) => void): string {
	const logger = Logger.create('Plugins');
	const spy = spyOn(console, 'error').mockImplementation(() => {});

	Logger.setInspector(null);

	try {
		log(logger);

		return spy.mock.calls[0].slice(2).join(' ');
	} finally {
		spy.mockRestore();
	}
}

test('logs an error with its name, code, message and stack frames', () => {
	const error = Object.assign(new Error('The Java class com.example.Missing is unavailable'), {
		code: 'NATIVE_BRIDGE_ERROR',
	});
	const line = loggedLine((logger) => logger.error('Failed to start addon:', error));

	expect(line).toStartWith(
		'Failed to start addon: Error [NATIVE_BRIDGE_ERROR]: The Java class com.example.Missing is unavailable',
	);
	expect(line).toContain('logger.test.ts');
});

test('logs errors nested inside objects instead of an empty object', () => {
	const line = loggedLine((logger) =>
		logger.error({ addon: 'demo', cause: new TypeError('bad value') }),
	);

	expect(line).toContain('"addon":"demo"');
	expect(line).toContain('TypeError: bad value');
});
