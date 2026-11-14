import { describe, expect, test } from 'bun:test';

import { parseDebugCardLeniently } from '~/debug-card-lenient';

const report = {
	client: 'v3.0.0',
	commit: '7e15ee37d',
	loader: '1.4.0',
	loaderOrigin: 'Unbound.dylib',
	framework: 'ElleKit',
	discord: '353.0',
	discordChannel: 'Stable',
	discordBuild: '122208',
	appSource: 'App Store',
	react: '19.2.3',
	reactNative: '0.86.0',
	hermes: '250829098.0.15',
	bytecode: '98',
	platform: 'iOS',
	os: '26.0.1',
	device: 'iPhone SE (2nd generation)',
	flags: ['Jailbroken'],
};

describe('parseDebugCardLeniently', () => {
	test('leaves out optional fields that fail and keeps the rest', () => {
		const result = parseDebugCardLeniently({
			...report,
			clock: { utcOffset: 'UTC+01:00' },
			power: { lowPower: 'yes' },
			network: { type: 'wifi' },
		});

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.dropped.sort()).toEqual(['power']);
		expect(result.data.network).toEqual({ type: 'wifi' });
		expect('clock' in result.data).toBe(false);
	});

	test('still refuses a report whose required fields fail', () => {
		const result = parseDebugCardLeniently({
			...report,
			client: 5,
			power: { lowPower: 'yes' },
		});

		expect(result.success).toBe(false);
	});

	test('refuses anything that is not an object', () => {
		expect(parseDebugCardLeniently('nope').success).toBe(false);
	});
});
