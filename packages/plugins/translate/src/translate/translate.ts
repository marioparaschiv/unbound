import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';
import { metro, toasts } from '@unbound-app/api';

import { endpoint, getAccessToken, refreshSession } from '~/translate/session';
import { isInlineAvailable, showInline } from '~/translate/inline';

type Translation = {
	text?: unknown;
	translatedText?: unknown;
	detectedSourceLanguage?: unknown;
};

type TranslationResponse = Translation & {
	translations?: Translation[];
	detectedLanguage?: unknown;
};

export type TranslationResult = {
	text: string;
	source: string;
	target: string;
};

function readTranslation({ translatedText, translations }: TranslationResponse) {
	const first = Array.isArray(translations) ? translations[0] : undefined;

	for (const value of [translatedText, first?.translatedText, first?.text]) {
		if (typeof value === 'string') return value;
	}
}

function readDetectedLanguage({ detectedLanguage, translations }: TranslationResponse) {
	const first = Array.isArray(translations) ? translations[0] : undefined;
	const nested = (detectedLanguage as { language?: unknown } | null | undefined)?.language;

	for (const value of [nested, detectedLanguage, first?.detectedSourceLanguage]) {
		if (typeof value === 'string' && value) return value;
	}
}

/**
 * @description Translates text between the user's chosen languages, retrying once with fresh tokens on a 401.
 * @param text The text to translate.
 * @returns The translated text, with the source language the service detected when it was set to auto detect, and the target language.
 */
async function requestTranslation(text: string): Promise<TranslationResult> {
	const source = settings.sourceLanguage;
	const target = settings.targetLanguage;
	const body = JSON.stringify({ q: text, source, target });

	function request(token: string) {
		return fetch(endpoint('/translate'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body,
		});
	}

	let response = await request(await getAccessToken());

	if (response.status === 401) {
		response = await request(await refreshSession());
	}

	if (!response.ok) {
		const reason = await response.text().catch(() => messages.TRANSLATE_FAILED_REASON);

		throw new Error(format('TRANSLATE_FAILED', { status: response.status, reason }));
	}

	const payload = (await response.json()) as TranslationResponse;
	const translation = readTranslation(payload);

	if (translation === undefined) throw new Error(messages.TRANSLATE_INVALID_PAYLOAD);

	return {
		text: translation,
		source: source === 'auto' ? (readDetectedLanguage(payload) ?? source) : source,
		target,
	};
}

export type TranslatableMessage = {
	id?: string;
	channel_id?: string;
	content: string;
};

function showError(error: unknown) {
	toasts.show({
		title: messages.TRANSLATE_ERROR,
		content: error instanceof Error ? error.message : String(error),
	});
}

/**
 * @description Translates a message, copies the result, and shows it in a toast.
 * @param content The message text.
 * @returns A promise that settles once the user has been told the outcome.
 */
export async function copyTranslation(content: string): Promise<void> {
	try {
		const { text: translated } = await requestTranslation(content);

		await metro.common.Clipboard.setString(translated);
		toasts.show({ title: messages.TRANSLATED, content: translated });
	} catch (error) {
		showError(error);
	}
}

/**
 * @description Translates a message and shows the result the way the user chose: in place of the message's text, or copied and in a toast.
 * Falls back to the toast when the message has no id or channel, or when Discord's chat modules were not found.
 * @param message The message to translate.
 * @returns A promise that settles once the translation shows or the user has been told why it failed.
 */
export async function showTranslation({
	id,
	channel_id,
	content,
}: TranslatableMessage): Promise<void> {
	if (settings.display !== 'inline' || !id || !channel_id || !isInlineAvailable()) {
		return copyTranslation(content);
	}

	try {
		showInline(channel_id, id, content, await requestTranslation(content));
	} catch (error) {
		showError(error);
	}
}
