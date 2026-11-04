import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, expect, test } from 'bun:test';

const sent: string[] = [];
const Messages = {
	sendMessage: (_channelId: string, message: { content: string }) => {
		sent.push(message.content);
	},
	receiveMessage: () => {},
	editMessage: (_channelId: string, _messageId: string, message: { content: string }) => {
		sent.push(message.content);
	},
};

beforeEach(async () => {
	sent.length = 0;
	metro.register(Messages);
	await startPlugin();
});

test('sends a new message in Aussie English', () => {
	Messages.sendMessage('1', { content: 'thank you' });

	expect(sent).toEqual(['cheers, legend']);
});

test('edits a message in Aussie English', () => {
	Messages.editMessage('1', '2', { content: 'thank you' });

	expect(sent).toEqual(['cheers, legend']);
});
