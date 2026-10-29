import { describe, expect, test } from 'bun:test';

import { formatDebugInfo } from './format-debug-info';

const info = {
	client: 'v0.10.0',
	loader: '1.0.0',
	loaderOrigin: 'Unbound.dylib',
	discord: '352.0',
	discordBuild: '114462',
	appSource: 'App Store',
	react: '19.2.3',
	reactNative: '0.86.0',
	hermes: '0.12.0',
	bytecode: '98',
	platform: 'iOS',
	os: '26.0.1 (23A355)',
	device: 'iPhone SE (2nd generation)',
	flags: ['jailbroken', 'verified build'],
};

describe('formatDebugInfo', () => {
	test('lists each component on its own quoted line', () => {
		const text = formatDebugInfo(info);
		const quoted = text.split('\n').filter((line) => line.startsWith('> '));

		expect(text).toContain('**Unbound Debug Info**');
		expect(quoted).toHaveLength(6);

		for (const value of Object.values(info).flat()) {
			expect(quoted.some((line) => line.includes(value))).toBe(true);
		}
	});

	test('names the device state next to the device', () => {
		expect(formatDebugInfo(info)).toContain(
			'> Device: iPhone SE (2nd generation) (jailbroken, verified build)',
		);
		expect(formatDebugInfo({ ...info, flags: [] })).toContain(
			'> Device: iPhone SE (2nd generation)\n',
		);
	});
});
