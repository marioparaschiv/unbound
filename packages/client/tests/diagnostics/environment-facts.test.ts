import { describe, expect, test } from 'bun:test';

import { environmentFacts } from '~/diagnostics/environment-facts';

describe('environmentFacts', () => {
	test('drops the dylib count, injections and UUID from the binary', () => {
		expect(
			environmentFacts({
				binary: 'decrypted · min 16.0 · SDK 27.1 · 108 dylibs · 1 injected · UUID 2F737236',
			})?.binary,
		).toBe('decrypted · min 16.0 · SDK 27.1');
	});

	test('keeps only markers an ordinary install does not report', () => {
		expect(
			environmentFacts({
				markers: [
					'Developer Mode on',
					'WebView com.google.android.webview 131',
					'WebView com.google.android.webview 96',
					'SELinux permissive',
				],
			})?.markers,
		).toEqual(['WebView com.google.android.webview 96', 'SELinux permissive']);
	});

	test('names other Discord mods running alongside', () => {
		expect(environmentFacts({ markers: ['SELinux permissive'] }, ['Bunny'])?.markers).toEqual([
			'SELinux permissive',
			'another Discord mod: Bunny',
		]);
	});

	test('passes no report through as none', () => {
		expect(environmentFacts(undefined)).toBeUndefined();
	});
});
