import { logs, metro, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

function warnings() {
	return logs.entries.filter(({ level }) => level === 'warn' || level === 'error');
}

describe('the self test', () => {
	test('reports ok once replies are patched', async () => {
		metro.register({ createPendingReply: (reply: object) => reply });
		await startPlugin();

		expect(warnings()).toEqual([]);
	});

	test('reports the missing module when Discord has none', async () => {
		metro.markMissing('createPendingReply');
		await startPlugin();

		expect(warnings()).toEqual([
			{ level: 'warn', args: ['Reply mention skipped: Discord moved PendingReplyActions.'] },
		]);
	});
});
