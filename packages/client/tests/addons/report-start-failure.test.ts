import type { AddonManifest } from '@unbound-app/types';
import { describe, expect, mock, test } from 'bun:test';

import type { CrashEvent } from '~/diagnostics/crash-report';

const crashes: CrashEvent[] = [];

mock.module('~/diagnostics/crash-reports', () => ({
	reportCrash: async (event: CrashEvent) => void crashes.push(event),
}));

const { reportStartFailure } = await import('~/addons/report-start-failure');
const { watchFirstFrame } = await import('~/core/first-frame');

const manifest: AddonManifest = {
	id: 'addon.a',
	name: 'Addon A',
	description: 'test',
	authors: [{ name: 'Mario', id: '1' }],
	main: 'index.js',
	version: '1.0.0',
};
const addon = { id: manifest.id, version: manifest.version, manifest };

function nextTask(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('reportStartFailure', () => {
	test('reports a start failure only once Discord draws its first frame', async () => {
		reportStartFailure(addon, new Error('native undefined'), 'starting');
		await nextTask();

		expect(crashes).toEqual([]);

		watchFirstFrame();
		await nextTask();
		await nextTask();

		expect(
			crashes.map((crash) => [crash.addon?.id, crash.kind, crash.phase, crash.message]),
		).toEqual([['addon.a', 'start-failure', 'starting', 'native undefined']]);
	});

	test('reports right away once the first frame has been drawn', () => {
		crashes.length = 0;
		reportStartFailure(addon, new Error('later'), 'running');

		expect(crashes.map((crash) => crash.message)).toEqual(['later']);
	});
});
