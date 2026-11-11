import { logs, metro, patches, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

describe('the plugin', () => {
	test('marks the removals the user makes once Discord loads its actions', async () => {
		metro.register({ leaveGuild: (_id: string) => {}, deleteGuild: (_id: string) => {} });
		await startPlugin();

		expect(patches.applied.map(({ method }) => method)).toEqual(
			expect.arrayContaining(['leaveGuild', 'deleteGuild']),
		);
		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
		await stopPlugin();
	});

	test('skips marking server removals with one warning when Discord moved its actions', async () => {
		metro.markMissing('leaveGuild');
		await startPlugin();

		expect(logs.entries).toContainEqual({
			level: 'warn',
			args: ['Own server removals skipped: Discord moved leaveGuild.'],
		});
		await stopPlugin();
	});
});
