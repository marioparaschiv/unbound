import { describe, expect, test } from 'bun:test';

import { commandId, commandMention, invokedCommand } from '~/lib/mentions';

const commands = [
	{ id: '1', name: 'ban', application_id: 'bot' },
	{ id: '2', name: 'ban', application_id: 'other' },
];

describe('command mentions', () => {
	test('read the command a reply came from', () => {
		expect(invokedCommand({ interaction: { name: 'ban user' }, applicationId: 'bot' })).toEqual(
			{
				name: 'ban user',
				applicationId: 'bot',
			},
		);
		expect(
			invokedCommand({ interactionMetadata: { name: 'ping' }, author: { id: 'bot' } }),
		).toEqual({
			name: 'ping',
			applicationId: 'bot',
		});
		expect(invokedCommand({ author: { id: 'bot' } })).toBeUndefined();
	});

	test('find the top-level command of the same application', () => {
		expect(commandId(commands, { name: 'ban user', applicationId: 'other' })).toBe('2');
		expect(commandId(commands, { name: 'kick', applicationId: 'bot' })).toBeUndefined();
	});

	test('write the clickable mention with subcommands', () => {
		expect(commandMention({ name: 'ban user', applicationId: 'bot' }, '1')).toBe(
			'</ban user:1>',
		);
	});
});
