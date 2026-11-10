import { settings } from '@unbound-app/settings';
import { flux, patcher } from '@unbound-app/api';

import { languageFlag } from '~/translate/flags';

import { ChatManager, MessageStore, RowManager } from '~/translate/modules';
import type { TranslationResult } from '~/translate/translate';

const CHANGE_TYPE_NONE = 0;
const CHANGE_TYPE_UPDATE = 2;
const REDRAW_TIMEOUT_MS = 1000;

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

type StoredMessage = {
	content?: string;
	author?: unknown;
};

type MessageLookup = {
	getMessage(channelId: string, messageId: string): StoredMessage | undefined;
};

type Translation = {
	channelId: string;
	original: string;
	shown: string;
};

const translations = new Map<string, Translation>();
const pendingRenders = new Set<string>();
let active = false;
let onRendersHandled: (() => void) | undefined;

function rendersHandled(): Promise<void> {
	if (!pendingRenders.size) return Promise.resolve();

	return new Promise((resolve) => {
		const timer = setTimeout(finish, REDRAW_TIMEOUT_MS);

		function finish() {
			clearTimeout(timer);
			onRendersHandled = undefined;
			resolve();
		}

		onRendersHandled = finish;
	});
}

function handleRender(messageId: string): boolean {
	if (!pendingRenders.delete(messageId)) return false;
	if (!pendingRenders.size) onRendersHandled?.();

	return true;
}

function redraw(channelId: string, messageId: string): Promise<void> {
	const message = (MessageStore as unknown as MessageLookup).getMessage(channelId, messageId);

	if (!message) return Promise.resolve();

	pendingRenders.add(messageId);

	return flux.dispatch({
		type: 'MESSAGE_UPDATE',
		message: {
			id: messageId,
			channel_id: channelId,
			content: message.content,
			author: message.author,
		},
	} as Parameters<typeof flux.dispatch>[0]);
}

/**
 * @description Tells whether inline translation is running, so the action sheet can fall back to a toast when Discord's chat modules are missing.
 * @returns `true` while the row patches are applied.
 */
export function isInlineAvailable(): boolean {
	return active;
}

/**
 * @description Tells whether a message currently shows its translation in the chat.
 * @param messageId The message.
 * @returns `true` when the message's row shows a translation.
 */
export function isShownInline(messageId: string): boolean {
	return translations.has(messageId);
}

export type LanguageCodeStyle = {
	/** Whether the translation ends with its languages, such as `(en -> de)`. */
	showLanguages: boolean;
	/** Whether the languages show as flag emojis where a language has one, such as `(🇬🇧 -> 🇩🇪)`. */
	flags: boolean;
};

/**
 * @description Builds the markdown a translated message shows: its original text, then the translation as italic subtext, ending with its languages unless they are hidden.
 * @param original The message text.
 * @param translation The translation and its language codes.
 * @param style How the languages show.
 * @returns The text to draw, such as `Hello` + `\n-# *Hallo* (en -> de)`.
 */
export function withTranslation(
	original: string,
	{ text, source, target }: TranslationResult,
	style: LanguageCodeStyle = { showLanguages: true, flags: false },
): string {
	const lines = text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => `-# *${line}*`);
	const label = style.flags ? languageFlag : (code: string) => code;
	const codes = style.showLanguages ? `(${label(source)} -> ${label(target)})` : '';

	if (!lines.length) return codes ? `${original}\n-# ${codes}` : original;

	if (codes) lines[lines.length - 1] += ` ${codes}`;

	return `${original}\n${lines.join('\n')}`;
}

/**
 * @description Shows a translation below a message's text, until the message is edited or the original is asked for.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @param original The message text that was translated.
 * @param translation The translation and its language codes.
 */
export function showInline(
	channelId: string,
	messageId: string,
	original: string,
	translation: TranslationResult,
): void {
	translations.set(messageId, {
		channelId,
		original,
		shown: withTranslation(original, translation, {
			showLanguages: settings.showLanguages,
			flags: settings.languageFlags,
		}),
	});
	void redraw(channelId, messageId);
}

/**
 * @description Shows a message's original text again.
 * @param messageId The message.
 */
export function hideInline(messageId: string): void {
	const translation = translations.get(messageId);

	if (!translation) return;

	translations.delete(messageId);
	void redraw(translation.channelId, messageId);
}

/**
 * @description Draws translations in the chat: each translated message's row shows its original text, then the translation as italic subtext, ending with its languages unless they are hidden.
 * Patches `generate` on Discord's `RowManager` and `determineChangeType` on its `ChatManager`, so a translation redraws its row.
 * @returns A function that draws every translated message's original text again, then removes both patches once Discord handled the redraws.
 */
export function patchInlineRows(): () => Promise<void> {
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

	const unpatchRows = patcher.after(
		RowManager.prototype,
		'generate',
		({ args: [input], result, this: self }) => {
			const row = result as ChatRow | undefined;
			const messageId = row?.message?.id;
			const translation = messageId ? translations.get(messageId) : undefined;

			if (generatingTranslation || !row?.message || !messageId || !translation) return;

			if ((input as RowInput).message?.content !== translation.original) {
				translations.delete(messageId);

				return;
			}

			const content = translatedContent(
				self as RowGenerator,
				input as RowInput,
				translation.shown,
			);

			if (content) row.message.content = content;
		},
	);

	const unpatchChanges = patcher.after(
		ChatManager.prototype,
		'determineChangeType',
		({ args: [input], result }) => {
			const messageId = (input as ChangeInput | undefined)?.message?.id;

			if (!messageId || !handleRender(messageId) || result !== CHANGE_TYPE_NONE) return;

			return CHANGE_TYPE_UPDATE;
		},
	);

	active = true;

	return () => {
		active = false;

		const shown = [...translations];

		translations.clear();

		return Promise.allSettled(
			shown.map(([messageId, { channelId }]) => redraw(channelId, messageId)),
		)
			.then(rendersHandled)
			.then(() => {
				unpatchRows();
				unpatchChanges();
				pendingRenders.clear();
			});
	};
}
