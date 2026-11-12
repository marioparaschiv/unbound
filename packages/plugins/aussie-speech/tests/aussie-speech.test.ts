import { flux, metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, expect, test } from 'bun:test';

import { selfTest } from '~/index';
import { aussieToggle } from '~/lib/toggle';

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
	flux.seed({ SelectedChannel: { getChannelId: () => '1' } });
	if (!aussieToggle.isActive('1', true)) {
		aussieToggle.toggle('1', true);
	}
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

test('reports the translation applied once the plugin starts', () => {
	expect(selfTest().ok).toBe(true);
});

test('sends a message unchanged once the toggle is off', () => {
	aussieToggle.toggle('1', true);
	Messages.sendMessage('1', { content: 'thank you' });

	expect(sent).toEqual(['thank you']);
});
