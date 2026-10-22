import { metro, patcher, storage } from '@unbound-app/api';

import {
	applyRules,
	normalizeRules,
	TEXT_REPLACE_RULES_CHANNEL_ID,
	type TextReplaceRule,
} from '@text-replace/rules';
import { TextReplaceSettingsScreen } from '@text-replace/settings';

const STORE = storage.getStore('unbound.text-replace');
const unpatches: Array<() => void> = [];

function getRules(kind: 'stringRules' | 'regexRules'): TextReplaceRule[] {
	return normalizeRules(STORE.get(kind, []));
}

function findMessageArg(args: unknown[]): { content?: string } | null {
	for (const arg of args) {
		if (
			arg &&
			typeof arg === 'object' &&
			typeof (arg as { content?: unknown }).content === 'string'
		) {
			return arg as { content?: string };
		}
	}

	return null;
}

function findChannelId(args: unknown[]): string | null {
	return typeof args[0] === 'string' ? args[0] : null;
}

function transformMessage(ctx: { args: unknown[] }): void {
	if (findChannelId(ctx.args) === TEXT_REPLACE_RULES_CHANNEL_ID) return;

	const message = findMessageArg(ctx.args);
	if (!message?.content) return;

	message.content = applyRules(message.content, getRules('stringRules'), getRules('regexRules'));
}

export default {
	start() {
		STORE.set('stringRules', getRules('stringRules'));
		STORE.set('regexRules', getRules('regexRules'));

		const messageActions = metro.findByProps('sendMessage', 'editMessage') as {
			sendMessage?: unknown;
		} | null;
		if (typeof messageActions?.sendMessage !== 'function') return;

		unpatches.push(patcher.before(messageActions, 'sendMessage', transformMessage));
	},

	stop() {
		while (unpatches.length) unpatches.pop()!();
	},

	getSettingsPanel: () => <TextReplaceSettingsScreen />,
};
