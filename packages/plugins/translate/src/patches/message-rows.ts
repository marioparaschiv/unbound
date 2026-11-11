import { metro, patcher } from '@unbound-app/api';

import { forgetTranslation, getTranslation, handleRender, markInlineAvailable } from '~/lib/inline';

const CHANGE_TYPE_NONE = 0;
const CHANGE_TYPE_UPDATE = 2;

type ContentNode = {
	type: string;
	content?: unknown;
};

type ChatRow = {
	message?: {
		id?: string;
		content?: ContentNode[];
	};
};

type MessageRecord = {
	id: string;
	content?: string;
	set(key: string, value: unknown): MessageRecord;
};

type RowInput = {
	message?: MessageRecord;
};

type RowGenerator = {
	generate(input: RowInput): ChatRow;
};

type ChangeInput = {
	message?: { id?: string };
};

let generatingTranslation = false;

function translatedContent(generator: RowGenerator, input: RowInput, text: string) {
	if (typeof input.message?.set !== 'function') return null;

	generatingTranslation = true;

	try {
		const row = generator.generate({
			...input,
			message: input.message.set('content', text),
		});

		return Array.isArray(row?.message?.content) ? row.message.content : null;
	} catch {
		return null;
	} finally {
		generatingTranslation = false;
	}
}

/**
 * @description Draws translations in the chat: each translated message's row shows its original text, then the translation as italic subtext, ending with its languages unless they are hidden.
 * Patches `generate` on Discord's `RowManager` and `determineChangeType` on its `ChatManager`, so a translation redraws its row.
 */
export function patchMessageRows(): void {
	const RowManager = metro.findByName('RowManager');
	const ChatManager = metro.findByName('ChatManager');

	if (!RowManager || !ChatManager) {
		logger.warn('Inline translation skipped: Discord moved RowManager or ChatManager.');

		return;
	}

	patcher.after(RowManager.prototype, 'generate', ({ args: [input], result, this: self }) => {
		const row = result as ChatRow | undefined;
		const messageId = row?.message?.id;
		const translation = messageId ? getTranslation(messageId) : undefined;

		if (generatingTranslation || !row?.message || !messageId || !translation) return;

		if ((input as RowInput).message?.content !== translation.original) {
			forgetTranslation(messageId);

			return;
		}

		const content = translatedContent(
			self as RowGenerator,
			input as RowInput,
			translation.shown,
		);

		if (content) row.message.content = content;
	});

	patcher.after(ChatManager.prototype, 'determineChangeType', ({ args: [input], result }) => {
		const messageId = (input as ChangeInput | undefined)?.message?.id;

		if (!messageId || !handleRender(messageId) || result !== CHANGE_TYPE_NONE) return;

		return CHANGE_TYPE_UPDATE;
	});

	markInlineAvailable();
}
