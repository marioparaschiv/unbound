import { describe, expect, test } from 'bun:test';

import { formatDebugInfo } from './format-debug-info';

describe('formatDebugInfo', () => {
	test('lists each component on its own quoted line', () => {
		const info = {
			client: 'v0.10.0',
			loader: '1.4.1',
			discord: '349.0',
			discordBuild: '114462',
			react: '19.2.3',
			reactNative: '0.86.0',
			hermes: '0.12.0',
			bytecode: '98',
			system: 'iOS 26.5',
			device: 'iPhone17,1',
		};
		const text = formatDebugInfo(info);
		const quoted = text.split('\n').filter((line) => line.startsWith('> '));

		expect(text).toContain('**Unbound Debug Info**');
		expect(quoted.length).toBeGreaterThanOrEqual(6);

		for (const value of Object.values(info)) {
			expect(quoted.some((line) => line.includes(value))).toBe(true);
		}
	});
});
