import { installAddonGlobals } from '@unbound-app/api/testing';
import { describe, expect, mock, test } from 'bun:test';

type Draft = { content: string };

const sent: Draft[] = [];
const edited: Draft[] = [];
const Messages = {
	sendMessage: (_channelId: string, draft: Draft) => void sent.push(draft),
	editMessage: (_channelId: string, _messageId: string, draft: Draft) => void edited.push(draft),
};

const scope = installAddonGlobals({ manifest: { id: 'astral.clear-urls' } });

Object.assign(scope.metro, { api: { Messages } });

mock.module('@unbound-app/api', () => scope.unbound);

const { patchMessageActions, patchedMethods } = await import('~/patches/message-actions');

patchMessageActions();

describe('patchMessageActions', () => {
	test('patches sending and editing through the scoped patcher', () => {
		expect(patchedMethods()).toEqual(['sendMessage', 'editMessage']);
		expect(scope.patcher.patches).toMatchObject([
			{ kind: 'before', target: Messages, method: 'sendMessage' },
			{ kind: 'before', target: Messages, method: 'editMessage' },
		]);
	});

	test('cleans links in a sent message', () => {
		Messages.sendMessage('c1', { content: 'https://example.com/a?utm_source=x&id=7' });

		expect(sent.at(-1)?.content).toBe('https://example.com/a?id=7');
	});

	test('cleans links in an edited message', () => {
		Messages.editMessage('c1', 'm1', { content: 'https://example.com/?fbclid=y' });

		expect(edited.at(-1)?.content).toBe('https://example.com/');
	});
});
