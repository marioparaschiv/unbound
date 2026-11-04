import { metro, render, startPlugin, stopPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { storage } from '@unbound-app/api';
import { Share } from 'react-native';

import { selfTest } from '~/index';
import RulesetTransfer from '~/components/ruleset-transfer';
import { RULES_CHANNEL_ID } from '~/constants';

type Sent = { channelId: string; content: string };

const sent: Sent[] = [];
const Messages = {
	sendMessage: (channelId: string, message: { content: string }) =>
		sent.push({ channelId, content: message.content }),
	receiveMessage: () => {},
};

const copied: string[] = [];
const Clipboard = {
	setString: (value: string) => void copied.push(value),
	getString: async () => copied.at(-1) ?? '',
	setImage: () => {},
	getImage: () => {},
};

function rule(find: string, replace: string, onlyIfIncludes = '') {
	return { id: find, find, replace, onlyIfIncludes };
}

// Lets the pressed row's async share finish.
async function settle() {
	for (let tick = 0; tick < 5; tick++) await Promise.resolve();
}

beforeEach(() => {
	sent.length = 0;
	copied.length = 0;
	metro.register(Messages);
	metro.register(Clipboard);
});

describe('outgoing messages', () => {
	test('replace text and regex matches', async () => {
		const bucket = storage.getBucket();

		bucket.set('stringRules', [rule('teh', 'the')]);
		bucket.set('regexRules', [rule('/c(a+)t/gi', 'dog')]);
		await startPlugin();

		Messages.sendMessage('1', { content: 'teh caaat' });

		expect(sent).toEqual([{ channelId: '1', content: 'the dog' }]);
	});

	test('apply a rule only when the message contains its condition', async () => {
		storage.getBucket().set('stringRules', [rule('cat', 'dog', 'pets')]);
		await startPlugin();

		Messages.sendMessage('1', { content: 'cat' });
		Messages.sendMessage('1', { content: 'cat pets' });

		expect(sent.map((message) => message.content)).toEqual(['cat', 'dog pets']);
	});

	test('leave messages to the shared rules channel alone', async () => {
		storage.getBucket().set('stringRules', [rule('teh', 'the')]);
		await startPlugin();

		Messages.sendMessage(RULES_CHANNEL_ID, { content: 'teh' });

		expect(sent).toEqual([{ channelId: RULES_CHANNEL_ID, content: 'teh' }]);
	});

	test('send messages unchanged once the plugin stops', async () => {
		storage.getBucket().set('stringRules', [rule('teh', 'the')]);
		await startPlugin();
		await stopPlugin();

		Messages.sendMessage('1', { content: 'teh' });

		expect(sent).toEqual([{ channelId: '1', content: 'teh' }]);
	});

	test('report themselves applied to the self test once started', async () => {
		await startPlugin();

		expect(selfTest().ok).toBe(true);
	});

	test('give stored rules an id when the plugin starts', async () => {
		const bucket = storage.getBucket();

		bucket.set('stringRules', [{ find: 'teh', replace: 'the' }]);
		await startPlugin();

		expect(bucket.get('stringRules', [])).toMatchObject([
			{ find: 'teh', id: expect.any(String) },
		]);
	});
});

describe('sharing the rules', () => {
	const ruleset = { stringRules: [rule('teh', 'the')], regexRules: [] };

	test('copy the ruleset and open the share sheet with it', async () => {
		const share = spyOn(Share, 'share');

		await startPlugin();
		const view = render(<RulesetTransfer ruleset={ruleset} />);

		view.act(() => view.find('Row').props.onPress?.());
		await settle();

		expect(copied).toHaveLength(1);
		expect(share).toHaveBeenCalledWith({ message: copied[0] });
		expect(toasts.shown).toMatchObject([{ key: 'RULESET_COPIED_AND_SHARED' }]);
	});

	test('still copy the ruleset when sharing is unavailable', async () => {
		spyOn(Share, 'share').mockRejectedValue(new Error('no share sheet'));

		await startPlugin();
		const view = render(<RulesetTransfer ruleset={ruleset} />);

		view.act(() => view.find('Row').props.onPress?.());
		await settle();

		expect(toasts.shown).toMatchObject([{ key: 'RULESET_COPIED' }]);
	});
});
