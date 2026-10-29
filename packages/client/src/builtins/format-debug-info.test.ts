import { describe, expect, test } from 'bun:test';

import { formatDebugInfo } from './format-debug-info';

const info = {
	client: 'v0.11.0',
	commit: '402cbbf6',
	loader: '1.0.0',
	loaderOrigin: 'Unbound.dylib',
	framework: 'ElleKit',
	discord: '351.0',
	discordChannel: 'Stable',
	discordBuild: '118370',
	appSource: 'App Store',
	react: '19.2.3',
	reactNative: '0.86.0',
	hermes: '250829098.0.15',
	bytecode: '98',
	platform: 'iOS',
	os: '26.0.1 (23A355)',
	device: 'iPhone SE (2nd generation)',
	flags: ['jailbroken'],
};

describe('formatDebugInfo', () => {
	test('puts every detail under a heading, one labelled line per component', () => {
		expect(formatDebugInfo(info)).toBe(
			[
				'### Unbound Debug Info',
				'- **Unbound:** v0.11.0 (`402cbbf6`), loader 1.0.0 (`Unbound.dylib`, `ElleKit`)',
				'- **Discord:** 351.0 Stable, build 118370 (App Store)',
				'- **Device:** iPhone SE (2nd generation) on iOS 26.0.1 (23A355)',
				'- **State:** jailbroken',
				'- **Runtime:** React 19.2.3, React Native 0.86.0, Hermes 250829098.0.15 (HBC 98)',
			].join('\n'),
		);
	});

	test('leaves out the framework when nothing injected the loader', () => {
		expect(formatDebugInfo({ ...info, framework: '' })).toContain(
			'loader 1.0.0 (`Unbound.dylib`)',
		);
	});
});
