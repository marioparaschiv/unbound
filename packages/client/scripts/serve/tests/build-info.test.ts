import { describe, expect, test } from 'bun:test';

import { staleWarning, type BuildInfo } from '../build-info';

function report(stale: boolean, served = 'unbound-dev.98.bundle'): BuildInfo {
	return {
		revision: 'abc1234',
		sourcesChangedAt: '2026-11-19T12:00:00.000Z',
		served,
		bundles: [
			{ file: 'unbound-dev.98.bundle', builtAt: '2026-11-17T16:23:00.000Z', stale },
			{ file: 'unbound.98.bundle', builtAt: '2026-11-19T12:30:00.000Z', stale: false },
		],
	};
}

describe('stale bundle warning', () => {
	test('names the served bundle when sources changed after it was built', () => {
		expect(staleWarning(report(true))).toContain(
			'unbound-dev.98.bundle was built at 2026-11-17',
		);
	});

	test('stays quiet while the served bundle is current', () => {
		expect(staleWarning(report(false))).toBeUndefined();
	});

	test('stays quiet until a device has fetched a bundle', () => {
		expect(staleWarning({ ...report(true), served: undefined })).toBeUndefined();
	});

	test('judges only the bundle devices were served', () => {
		expect(staleWarning(report(true, 'unbound.98.bundle'))).toBeUndefined();
	});
});
