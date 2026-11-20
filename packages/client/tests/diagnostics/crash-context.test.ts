import { describe, expect, test } from 'bun:test';

import { scrubBreadcrumbs, withPackages } from '~/diagnostics/crash-context';

describe('scrubBreadcrumbs', () => {
	test('blanks Discord ids and secrets, keeping the newest forty', () => {
		const lines = Array.from({ length: 45 }, (_, index) => `12:00:00 nav: ${index}`);

		lines.push('12:00:01 navigation: /channels/709061970078335027/709062739581992971');
		lines.push('12:00:02 http: authorization=abc.def');

		const scrubbed = scrubBreadcrumbs(lines);

		expect(scrubbed).toHaveLength(40);
		expect(scrubbed.at(-2)).toBe('12:00:01 navigation: /channels/<id>/<id>');
		expect(scrubbed.at(-1)).toBe('12:00:02 http: authorization=[redacted]');
	});
});

describe('withPackages', () => {
	test('names the package that installed each injected library', () => {
		Reflect.set(globalThis, 'NativePlatform', {
			device: { getState: () => ({ injectedPackages: { Choicy: 'com.opa334.choicy' } }) },
		});

		expect(withPackages(['Choicy', 'Crane'])).toEqual(['Choicy (com.opa334.choicy)', 'Crane']);
		expect(withPackages(undefined)).toBeUndefined();

		Reflect.deleteProperty(globalThis, 'NativePlatform');
	});

	test('adds the version of each Android module', () => {
		Reflect.set(globalThis, 'NativePlatform', {
			device: { getState: () => ({ injectedVersions: { 'com.example.hide': '2.1.0' } }) },
		});

		expect(withPackages(['com.example.hide', 'zygisk_shamiko'])).toEqual([
			'com.example.hide 2.1.0',
			'zygisk_shamiko',
		]);

		Reflect.deleteProperty(globalThis, 'NativePlatform');
	});
});
