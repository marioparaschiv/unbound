import { describe, expect, test } from 'bun:test';

import {
	loaderLogLabel,
	plainLoaderLogLines,
	plainLoaderLogText,
	readLoaderLogLine,
	type LoaderLogLine,
} from '~/lib/loader-log-line';

const T = Date.parse('2026-10-29T17:38:51.031Z');

function entry(src: LoaderLogLine['src'], scope: string[], msg: string): LoaderLogLine {
	return { t: T, src, lvl: 'warn', scope, msg };
}

describe('readLoaderLogLine', () => {
	test('reads a JSON line', () => {
		const line = entry('js', [], 'hello');

		expect(readLoaderLogLine(JSON.stringify(line))).toEqual(line);
	});

	test('maps an older loader plain line onto the same shape', () => {
		expect(readLoaderLogLine('2026-10-29T17:38:51.031Z W [plugins] slow')).toEqual(
			entry('unbound', ['Loader', 'plugins'], 'slow'),
		);
		expect(readLoaderLogLine("2026-10-29T17:38:51.031Z W [console] 'hi'")).toEqual(
			entry('js', [], "'hi'"),
		);
	});

	test('rejects a cut-off JSON line, an unknown source and a continuation line', () => {
		expect(readLoaderLogLine('{"t":1,"src":"js","lvl":"info","sc')).toBeUndefined();
		expect(
			readLoaderLogLine('{"t":1,"src":"swift","lvl":"info","scope":[],"msg":"x"}'),
		).toBeUndefined();
		expect(readLoaderLogLine('    at foo (unbound:1:2)')).toBeUndefined();
	});
});

describe('loaderLogLabel', () => {
	test('names the source, then the scope', () => {
		expect(loaderLogLabel(entry('unbound', ['Loader', 'plugins'], ''))).toBe(
			'unbound [Loader/plugins]',
		);
		expect(loaderLogLabel(entry('native', [], ''))).toBe('native');
	});
});

describe('plainLoaderLogText', () => {
	test('renders each source the way older loaders wrote it', () => {
		const stamp = '2026-10-29T17:38:51.031Z W';

		expect(plainLoaderLogText(entry('unbound', ['Loader', 'plugins'], 'slow'))).toBe(
			`${stamp} [plugins] slow`,
		);
		expect(plainLoaderLogText(entry('js', [], "'x'"))).toBe(`${stamp} [console] 'x'`);
		expect(plainLoaderLogText(entry('unbound', ['Toasts', 'Api'], 'Showing'))).toBe(
			`${stamp} [console] [Toasts → Api] Showing`,
		);
		expect(plainLoaderLogText(entry('react-native', ['RCTLog'], 'boom'))).toBe(
			`${stamp} [react-native/RCTLog] boom`,
		);
	});
});

describe('plainLoaderLogLines', () => {
	test('splits multi-line messages and passes other lines through', () => {
		expect(
			plainLoaderLogLines([
				JSON.stringify(entry('js', [], 'first\n    at f (unbound:1:2)')),
				'2026-10-29T17:38:51.031Z E [plugins] plain',
			]),
		).toEqual([
			'2026-10-29T17:38:51.031Z W [console] first',
			'    at f (unbound:1:2)',
			'2026-10-29T17:38:51.031Z E [plugins] plain',
		]);
	});
});
