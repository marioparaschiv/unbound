import { metro, toasts } from '@unbound-app/api';

import { endpoint, getAccessToken, refreshSession } from '~/session';
import { settings } from '~/modules';

type Translation = {
	text?: unknown;
	translatedText?: unknown;
};

type TranslationResponse = Translation & {
	translations?: Translation[];
};

function readTranslation({ translatedText, translations }: TranslationResponse) {
	const first = Array.isArray(translations) ? translations[0] : undefined;

	for (const value of [translatedText, first?.translatedText, first?.text]) {
		if (typeof value === 'string') return value;
	}
}

/**
 * @description Translates text between the user's chosen languages, retrying once with fresh tokens on a 401.
 * @param text The text to translate.
 * @returns The translated text.
 */
async function translateText(text: string): Promise<string> {
	const body = JSON.stringify({
		q: text,
		source: settings.get('sourceLanguage', 'auto'),
		target: settings.get('targetLanguage', 'en'),
	});

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
		const reason = await response.text().catch(() => 'translation failed');

		throw new Error(`Translate failed (${response.status}): ${reason}`);
	}

	const translation = readTranslation((await response.json()) as TranslationResponse);

	if (translation === undefined) {
		throw new Error('Translation API returned an unexpected payload.');
	}

	return translation;
}

/**
 * @description Translates a message, copies the result, and shows it in a toast.
 * @param content The message text.
 * @returns A promise that settles once the user has been told the outcome.
 */
export async function copyTranslation(content: string): Promise<void> {
	try {
		const translated = await translateText(content);

		await metro.common.Clipboard.setString(translated);
		toasts.showToast({ title: 'Translated', content: translated });
	} catch (error) {
		toasts.showToast({
			title: 'Translate Error',
			content: error instanceof Error ? error.message : String(error),
		});
	}
}
