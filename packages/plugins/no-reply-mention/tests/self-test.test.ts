import { metro, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

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
