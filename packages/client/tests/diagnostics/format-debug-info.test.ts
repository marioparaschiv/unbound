import { describe, expect, test } from 'bun:test';

import { formatDebugInfo } from '~/diagnostics/format-debug-info';

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
	flags: ['Jailbroken', 'verified build'],
};

describe('formatDebugInfo', () => {
	test('inserts the detected jailbreak between loader identity and injection framework', () => {
		expect(formatDebugInfo({ ...info, jailbreak: 'Dopamine' })).toContain(
			'loader 1.0.0 (`Unbound.dylib`) (`Dopamine`) (`ElleKit`)',
		);
	});

	test('puts every detail under a heading, one labelled line per component', () => {
		expect(formatDebugInfo(info)).toBe(
			[
				'### Unbound Debug Info',
				'- **Unbound:** v0.11.0 (`402cbbf6`), loader 1.0.0 (`Unbound.dylib`) (`ElleKit`)',
				'- **Discord:** 351.0 stable, build 118370 (App Store)',
				'- **Device:** iPhone SE (2nd generation) on iOS 26.0.1 (23A355)',
				'- **State:** Jailbroken · verified build',
				'- **Runtime:** React 19.2.3, React Native 0.86.0, Hermes 250829098.0.15 (HBC 98)',
			].join('\n'),
		);
	});

	test('says how a sideloaded app was signed, after the device', () => {
		const lines = formatDebugInfo({
			...info,
			appSource: 'Sideloaded (TestFlight build)',
			installDetails: 'Development (`ABCDE12345`) · exp 2027-09-16',
		}).split('\n');

		expect(lines).toContain(
			'- **Discord:** 351.0 stable, build 118370 (Sideloaded (TestFlight build))',
		);
		expect(lines[4]).toBe('- **Install:** Development (`ABCDE12345`) · exp 2027-09-16');
	});

	test('capitalises install details from loaders that send them in lower case', () => {
		const lines = formatDebugInfo({
			...info,
			installDetails: 'ad hoc certificate, team ABCDE12345, entitlements from the kernel',
		}).split('\n');

		expect(lines[4]).toBe(
			'- **Install:** Ad hoc certificate, team ABCDE12345, entitlements from the kernel',
		);
	});

	test('leaves out the framework when nothing injected the loader', () => {
		expect(formatDebugInfo({ ...info, framework: '' }).split('\n')).toContain(
			'- **Unbound:** v0.11.0 (`402cbbf6`), loader 1.0.0 (`Unbound.dylib`)',
		);
	});

	test('lists other tweaks loaded into Discord', () => {
		expect(formatDebugInfo({ ...info, injected: ['FLEXing', 'Shadow'] }).split('\n')).toContain(
			'- **Other tweaks:** FLEXing · Shadow',
		);
		expect(formatDebugInfo(info)).not.toContain('Other tweaks');
	});
});
