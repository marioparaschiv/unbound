import { unpackDebugAltText } from '@unbound-app/contracts/debug-card-alt-text';
import type { DebugCardRequest } from '@unbound-app/contracts/debug-cards';
import { describe, expect, test } from 'bun:test';

import {
	clockNote,
	dnsNote,
	gatewayNote,
	powerNote,
	pushNote,
} from '~/lib/debug-card/device-notes';
import { layoutDebugCard, type CardText } from '~/lib/debug-card/layout';
import { debugAltText } from '~/lib/debug-card/alt-text';

const info: DebugCardRequest = {
	client: 'v3.0.0',
	commit: '7e15ee37d',
	loader: '1.4.0',
	loaderOrigin: 'Unbound.dylib',
	framework: 'ElleKit 1.1.3',
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
	flags: ['Jailbroken', 'verified build'],
};

describe('device notes', () => {
	test('flag only what needs attention', () => {
		expect(powerNote({ lowPower: false, battery: 80, charging: false })).toBeUndefined();
		expect(powerNote({ lowPower: false, battery: 9 })).toBe('battery 9%');
		expect(powerNote({ lowPower: true, battery: 60, charging: true })).toBe(
			'low power · battery 60% · charging',
		);
		expect(clockNote({ utcOffset: 'UTC+01:00', skewS: 30 })).toBeUndefined();
		expect(clockNote({ utcOffset: 'UTC+01:00', skewS: -7200 })).toBe('clock 2 h behind');
		expect(
			pushNote({ permission: 'granted', registered: true, environment: 'production' }),
		).toBe(undefined);
		expect(pushNote({ permission: 'denied', playServices: false })).toBe(
			'notifications off · no Play services',
		);
		expect(dnsNote({ resolver: 'Cloudflare' })).toBeUndefined();
		expect(dnsNote({ resolver: 'local', privateDns: 'NextDNS' })).toBe(
			'local · private NextDNS',
		);
		expect(dnsNote({ resolver: 'AdGuard' })).toBe('AdGuard');
		expect(
			gatewayNote({ state: 'session established', latencyMs: 130, identifies: 2 }),
		).toBeUndefined();
		expect(gatewayNote({ state: 'will reconnect', latencyMs: 2400, failedAttempts: 3 })).toBe(
			'will reconnect · 2400 ms heartbeat · 3 failed connects',
		);
	});

	test('put a skewed clock on the card and every fact in the alt text', () => {
		const report: DebugCardRequest = {
			...info,
			clock: { utcOffset: 'UTC+01:00', skewS: 600 },
			push: { permission: 'granted', registered: true, environment: 'production' },
			power: { lowPower: false, battery: 70 },
			dns: { resolver: 'Cloudflare' },
		};
		const runs = layoutDebugCard(report).ops.filter((op): op is CardText => op.kind === 'text');

		expect(runs.map((run) => run.text)).toContain('clock 10 min ahead');
		expect(JSON.parse(unpackDebugAltText(debugAltText(report)) ?? '')).toMatchObject({
			clock: 'UTC+01:00 · 10 min ahead',
			push: 'granted · production',
			power: 'battery 70%',
			dns: 'Cloudflare',
		});
	});
});
