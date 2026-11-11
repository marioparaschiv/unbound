import { flux, logs, metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

beforeEach(() => {
	flux.seed({ PendingReply: { getPendingReply: () => undefined } });
});

describe('the self test', () => {
	test('passes once the commands are listed, with no warning', async () => {
		metro.register({ getBuiltInCommands: () => [] });
		metro.register({ sendMessage: () => undefined, receiveMessage: () => undefined });
		await startPlugin();

		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
	});

	test('fails with the missing module when Discord moved Commands', async () => {
		metro.markMissing('getBuiltInCommands');
		await startPlugin();

		expect(logs.entries).toContainEqual({
			level: 'warn',
			args: ['Saved commands skipped: Discord moved Commands or Messages.'],
		});
	});
});
