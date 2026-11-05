import { flux, metro, startPlugin } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

beforeEach(() => {
	resetHealth();
	flux.seed({ PendingReply: { getPendingReply: () => undefined } });
});

describe('the self test', () => {
	test('reports ok once the commands are listed', async () => {
		metro.register({ getBuiltInCommands: () => [] });
		metro.register({ sendMessage: () => undefined, receiveMessage: () => undefined });
		await startPlugin();

		expect(selfTest().ok).toBe(true);
	});

	test('reports the missing module when Discord has none of them', async () => {
		await startPlugin();

		expect(selfTest()).toMatchObject({ ok: false });
	});
});
