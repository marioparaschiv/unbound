import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { languageFlag } from '~/lib/flags';

import type { TranslationResult } from '~/lib/translate';

const REDRAW_TIMEOUT_MS = 1000;

const MessageStore = flux.getStore('Message');

type StoredMessage = {
	content?: string;
	author?: unknown;
};

type MessageLookup = {
	getMessage(channelId: string, messageId: string): StoredMessage | undefined;
};

/** A message shown translated: its channel, the text that was translated, and the text drawn instead. */
export type Translation = {
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

/**
 * @description Counts a row Discord redrew after a translation changed, settling the redraw `stop` waits for once none are left.
 * @param messageId The message whose row Discord checks for changes.
 * @returns `true` when the row was waiting for that redraw, so it must count as changed.
 */
export function handleRender(messageId: string): boolean {
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
 * @description Marks inline translation as running, once its row patches are applied.
 */
export function markInlineAvailable(): void {
	active = true;
}

/**
 * @description Reads the translation a message shows.
 * @param messageId The message.
 * @returns The translation, or `undefined` when the message shows its original text.
 */
export function getTranslation(messageId: string): Translation | undefined {
	return translations.get(messageId);
}

/**
 * @description Forgets a message's translation without redrawing it, such as once Discord drew its edited text.
 * @param messageId The message.
 */
export function forgetTranslation(messageId: string): void {
	translations.delete(messageId);
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
 * @description Draws every translated message's original text again, settling once Discord handled the redraws or after a timeout.
 * The row patches must stay applied until it settles, so Discord sees each row as changed.
 * @returns A promise that settles once the original text is drawn.
 */
export function redrawOriginalText(): Promise<void> {
	if (!active) return Promise.resolve();

	active = false;

	const shown = [...translations];

	translations.clear();

	return Promise.allSettled(
		shown.map(([messageId, { channelId }]) => redraw(channelId, messageId)),
	)
		.then(rendersHandled)
		.then(() => pendingRenders.clear());
}
