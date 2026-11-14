import { describe, expect, test } from 'bun:test';

import { formatLogEntry, parseLogLine, readableLogLine } from '~/logs/entry';

const T = Date.UTC(2026, 4, 1, 12, 30, 5, 42);

describe('log lines', () => {
	test('parse a JSON line', () => {
		const line = `{"t":${T},"src":"react-native","lvl":"warn","scope":["Bridge"],"msg":"slow"}`;

		expect(parseLogLine(line)).toEqual({
			t: T,
			src: 'react-native',
			lvl: 'warn',
			scope: ['Bridge'],
			msg: 'slow',
		});
	});

	test('default unknown sources, levels and scope parts in a JSON line', () => {
		const line = `{"t":${T},"src":"other","lvl":"loud","scope":["A",1],"msg":"x"}`;

		expect(parseLogLine(line)).toEqual({
			t: T,
			src: 'unbound',
			lvl: 'info',
			scope: ['A'],
			msg: 'x',
		});
	});

	test('reject a JSON line without a time or message, or cut short', () => {
		expect(parseLogLine('{"msg":"no time"}')).toBeUndefined();
		expect(parseLogLine(`{"t":${T}}`)).toBeUndefined();
		expect(parseLogLine(`{"t":${T},"msg":"cut`)).toBeUndefined();
	});

	test('parse the plain text older loaders wrote', () => {
		expect(parseLogLine('2026-05-01T12:30:05.042Z E [plugins] boom')).toEqual({
			t: T,
			src: 'unbound',
			lvl: 'error',
			scope: ['Loader', 'plugins'],
			msg: 'boom',
		});
		expect(parseLogLine("2026-05-01T12:30:05.042Z I [console] '[Core]', 'Ready'")).toEqual({
			t: T,
			src: 'js',
			lvl: 'info',
			scope: [],
			msg: "'[Core]', 'Ready'",
		});
		expect(parseLogLine('not a log line')).toBeUndefined();
	});

	test('format like the loader', () => {
		expect(
			formatLogEntry({
				t: T,
				src: 'unbound',
				lvl: 'debug',
				scope: ['Loader', 'fonts'],
				msg: 'hi',
			}),
		).toBe('2026-05-01T12:30:05.042Z D unbound [Loader/fonts] hi');
		expect(formatLogEntry({ t: T, src: 'js', lvl: 'info', scope: [], msg: 'hi' })).toBe(
			'2026-05-01T12:30:05.042Z I js hi',
		);
	});

	test('read JSON lines as text and keep other lines as written', () => {
		expect(
			readableLogLine(`{"t":${T},"src":"native","lvl":"error","scope":[],"msg":"x"}`),
		).toBe('2026-05-01T12:30:05.042Z E native x');
		expect(readableLogLine('2026-05-01T12:30:05.042Z E [plugins] boom')).toBe(
			'2026-05-01T12:30:05.042Z E [plugins] boom',
		);
	});
});
