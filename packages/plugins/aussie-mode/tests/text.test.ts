import { beforeEach, expect, mock, test } from 'bun:test';
import { patches } from '@unbound-app/api/testing';

const sent: unknown[] = [];
const Messages = {
	sendMessage: (_channelId: string, message: { content: string }) =>
		void sent.push(message.content),
	editMessage: (_channelId: string, _messageId: string, message: { content: string }) =>
		void sent.push(message.content),
};

// The testing kit has no `metro.api`, so the lookup file is replaced with the module it finds.
mock.module('~/text/modules', () => ({ Messages }));

const { startUpsideDownText } = await import('~/text');

beforeEach(() => {
	sent.length = 0;
	startUpsideDownText();
});

test('turns a message you send upside down', () => {
	Messages.sendMessage('1', { content: 'please wait a moment' });

	expect(sent).toEqual(['ʇuǝɯoɯ ɐ ʇᴉɐʍ ǝsɐǝld']);
});

test('turns a message you edit upside down', () => {
	Messages.editMessage('1', '2', { content: 'hello' });

	expect(sent).toEqual(['ollǝɥ']);
});

test('patches only sending and editing', () => {
	expect(patches.applied.map(({ method }) => method).toSorted()).toEqual([
		'editMessage',
		'sendMessage',
	]);
});
