import { describe, expect, test } from 'bun:test';

import { formatDebugInfo } from './format-debug-info';

describe('formatDebugInfo', () => {
	test('lists each component on its own quoted line', () => {
		const text = formatDebugInfo({
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
		});

		expect(text).toBe(
			[
				'**Unbound Debug Info**',
				'> Unbound: v0.10.0 (Loader 1.4.1)',
				'> Discord: 349.0 (114462)',
				'> React: 19.2.3 (RN 0.86.0)',
				'> Hermes: 0.12.0 (bcv98)',
				'> System: iOS 26.5',
				'> Device: iPhone17,1',
			].join('\n'),
		);
	});
});
