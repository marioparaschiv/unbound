import { metro, startPlugin } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { beforeEach, describe, expect, test } from 'bun:test';

beforeEach(() => {
	resetHealth();
});

async function selfTest() {
	const plugin = await import('~/index');

	return plugin.selfTest();
}

describe('the self test', () => {
	test('reports ok once replies are patched', async () => {
		metro.register({ createPendingReply: (reply: object) => reply });
		await startPlugin();

		expect(await selfTest()).toMatchObject({ ok: true });
	});

	test('reports the missing module when Discord has none', async () => {
		await startPlugin();

		expect(await selfTest()).toMatchObject({ ok: false });
	});
});
