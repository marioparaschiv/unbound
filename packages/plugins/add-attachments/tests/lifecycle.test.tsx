import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { flux, metro, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

// Health is module state that earlier tests in this process left behind.
beforeEach(() => {
	resetHealth();
	flux.seed({
		EditMessage: { getEditingMessage: () => null },
		User: { getCurrentUser: () => ({ id: 'me' }) },
	});
	metro.register({ openLazy: () => undefined, hideActionSheet: () => undefined });
	metro.register({ CloudUpload: class {} });
	metro.register({ getAPIBaseURL: () => '', patch: async () => undefined });
});

describe('lifecycle', () => {
	test('the self test passes once started and fails once stopped', async () => {
		await startPlugin();

		expect(selfTest()).toMatchObject({ ok: true });

		await stopPlugin();

		expect(selfTest()).toMatchObject({ ok: false });
	});
});
