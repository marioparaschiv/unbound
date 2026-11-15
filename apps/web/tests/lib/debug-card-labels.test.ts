import { describe, expect, test } from 'bun:test';

import { networkSummary, sourceLabel } from '~/lib/debug-card/layout';

describe('networkSummary', () => {
	test('names the connection, then whatever applies to it', () => {
		expect(networkSummary({ type: 'wifi', vpn: true, proxy: true, lowData: false })).toBe(
			'wifi · VPN · proxy',
		);
		expect(networkSummary({ type: 'cellular', metered: true, lowData: true })).toBe(
			'cellular · low data',
		);
		expect(networkSummary({ type: 'wifi', metered: true })).toBe('wifi · metered');
		expect(networkSummary({ type: 'offline' })).toBe('offline');
	});
});

describe('sourceLabel', () => {
	const now = new Date('2026-11-15T12:00:00Z');
	const launch = {
		bundle: 'active',
		earlyCloses: 0,
		recovery: false,
		previousExit: 'ended',
	} as const;

	test('adds how long ago a dev bundle was built', () => {
		expect(sourceLabel({ ...launch, source: 'dev' }, '2026-11-15T11:57:00Z', now)).toBe(
			'dev · built 3 min ago',
		);
		expect(sourceLabel({ ...launch, source: 'dev' }, '2026-11-15T07:00:00Z', now)).toBe(
			'dev · built 5 h ago',
		);
		expect(sourceLabel({ ...launch, source: 'dev' }, '2026-11-10T12:00:00Z', now)).toBe(
			'dev · built 5 d ago',
		);
	});

	test('keeps other sources and dev bundles without a build time as they were', () => {
		expect(sourceLabel({ ...launch, source: 'dev' }, undefined, now)).toBe('dev');
		expect(sourceLabel({ ...launch, source: 'custom' }, '2026-11-15T11:57:00Z', now)).toBe(
			'custom',
		);
		expect(sourceLabel({ ...launch, source: 'pr', pullRequest: 12 }, undefined, now)).toBe(
			'pr #12',
		);
		expect(sourceLabel(launch, '2026-11-15T11:57:00Z', now)).toBeUndefined();
	});
});
