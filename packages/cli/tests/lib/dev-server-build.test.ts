import { describe, expect, test } from 'bun:test';

import { describeDevServer, type DevServerBuild } from '~/lib/dev-server-build';

const NOW = Date.parse('2026-11-19T12:00:00.000Z');

function build(stale: boolean, served: string | null = 'unbound-dev.98.bundle'): DevServerBuild {
	return {
		revision: 'abc1234',
		sourcesChangedAt: '2026-11-19T11:30:00.000Z',
		...(served ? { served } : {}),
		bundles: [{ file: 'unbound-dev.98.bundle', builtAt: '2026-11-17T12:00:00.000Z', stale }],
	};
}

describe('dev server status line', () => {
	test('flags a served bundle older than the sources', () => {
		expect(describeDevServer(build(true), NOW)).toBe(
			'Dev server: STALE — serves unbound-dev.98.bundle built 2 d ago, but client sources changed 30 min ago; run bun run build:dev in packages/client',
		);
	});

	test('reports a current bundle plainly', () => {
		expect(describeDevServer(build(false), NOW)).toBe(
			'Dev server: serves unbound-dev.98.bundle built 2 d ago, current with the sources',
		);
	});

	test('says when nothing was served yet', () => {
		expect(describeDevServer(build(true, null), NOW)).toBe(
			'Dev server: at abc1234, has not served a bundle since it started',
		);
	});
});
