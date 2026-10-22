import { storage } from '@unbound-app/api';

export const PATCHER_ID = 'unbound.translate';
export const DEFAULT_API_BASE_URL = 'https://translate.unbound.rip';
export const DEFAULT_TARGET_LANGUAGE = 'en';
export const DEFAULT_SOURCE_LANGUAGE = 'auto';

const STORE = storage.getStore(PATCHER_ID);
const TOKEN_SKEW_MS = 15_000;

export type SessionTokens = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

export type TranslationLanguage = {
	code: string;
	name: string;
	nativeName?: string;
};

type TranslationResponse =
	| { translatedText?: string }
	| { translations?: Array<{ text?: string; translatedText?: string }> };

const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
	{ code: 'ar', name: 'Arabic', nativeName: 'العربية' },
	{ code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycanca' },
	{ code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
	{ code: 'ca', name: 'Catalan', nativeName: 'Català' },
	{ code: 'cs', name: 'Czech', nativeName: 'Čeština' },
	{ code: 'da', name: 'Danish', nativeName: 'Dansk' },
	{ code: 'de', name: 'German', nativeName: 'Deutsch' },
	{ code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
	{ code: 'en', name: 'English' },
	{ code: 'eo', name: 'Esperanto' },
	{ code: 'es', name: 'Spanish', nativeName: 'Español' },
	{ code: 'et', name: 'Estonian', nativeName: 'Eesti' },
	{ code: 'fa', name: 'Persian', nativeName: 'فارسی' },
	{ code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
	{ code: 'fr', name: 'French', nativeName: 'Français' },
	{ code: 'he', name: 'Hebrew', nativeName: 'עברית' },
	{ code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
	{ code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
	{ code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
	{ code: 'it', name: 'Italian', nativeName: 'Italiano' },
	{ code: 'ja', name: 'Japanese', nativeName: '日本語' },
	{ code: 'ko', name: 'Korean', nativeName: '한국어' },
	{ code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
	{ code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
	{ code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
	{ code: 'pl', name: 'Polish', nativeName: 'Polski' },
	{ code: 'pt', name: 'Portuguese', nativeName: 'Português' },
	{ code: 'ro', name: 'Romanian', nativeName: 'Română' },
	{ code: 'ru', name: 'Russian', nativeName: 'Русский' },
	{ code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
	{ code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
	{ code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
	{ code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
	{ code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
	{ code: 'zh', name: 'Chinese', nativeName: '中文' },
].sort((left, right) => left.name.localeCompare(right.name));

function getApiBaseUrl(): string {
	return STORE.get('apiBaseUrl', DEFAULT_API_BASE_URL);
}

function readTokens(): SessionTokens | null {
	const accessToken = STORE.get('accessToken', '');
	const refreshToken = STORE.get('refreshToken', '');
	const expiresAt = STORE.get('expiresAt', 0);

	if (!accessToken || !refreshToken || !expiresAt) return null;

	return { accessToken, refreshToken, expiresAt };
}

function writeTokens(tokens: SessionTokens): void {
	STORE.set('accessToken', tokens.accessToken);
	STORE.set('refreshToken', tokens.refreshToken);
	STORE.set('expiresAt', tokens.expiresAt);
}

export function storeSessionTokens(tokens: SessionTokens): void {
	writeTokens(tokens);
}

export function hasRefreshToken(): boolean {
	return (
		typeof STORE.get('refreshToken', '') === 'string' &&
		STORE.get('refreshToken', '').length > 0
	);
}

export function clearTokens(): void {
	STORE.remove('accessToken');
	STORE.remove('refreshToken');
	STORE.remove('expiresAt');
}

export function getSourceLanguage(): string {
	return STORE.get('sourceLanguage', DEFAULT_SOURCE_LANGUAGE);
}

export function getTargetLanguage(): string {
	return STORE.get('targetLanguage', DEFAULT_TARGET_LANGUAGE);
}

export function setSourceLanguage(code: string): void {
	STORE.set('sourceLanguage', code);
}

export function setTargetLanguage(code: string): void {
	STORE.set('targetLanguage', code);
}

export function getApiBaseUrlSetting(): string {
	return STORE.get('apiBaseUrl', DEFAULT_API_BASE_URL);
}

export function setApiBaseUrl(url: string): void {
	STORE.set('apiBaseUrl', url.trim() || DEFAULT_API_BASE_URL);
}

async function refreshSessionTokens(): Promise<SessionTokens> {
	const refreshToken = STORE.get('refreshToken', '');

	if (!refreshToken) {
		throw new Error('No refresh token configured. Open plugin settings and complete login.');
	}

	const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refreshToken }),
	});

	if (!response.ok) {
		if (response.status === 401) clearTokens();
		const reason = await response.text().catch(() => 'refresh failed');
		throw new Error(`Auth refresh failed (${response.status}): ${reason}`);
	}

	const data = (await response.json()) as {
		accessToken?: string;
		refreshToken?: string;
		expiresIn?: number;
	};

	if (!data.accessToken || !data.refreshToken || typeof data.expiresIn !== 'number') {
		throw new Error('Auth refresh returned an invalid payload.');
	}

	const next: SessionTokens = {
		accessToken: data.accessToken,
		refreshToken: data.refreshToken,
		expiresAt: Date.now() + data.expiresIn * 1000,
	};

	writeTokens(next);
	return next;
}

async function getValidAccessToken(): Promise<string> {
	const current = readTokens();
	if (current && current.expiresAt - TOKEN_SKEW_MS > Date.now()) {
		return current.accessToken;
	}

	const refreshed = await refreshSessionTokens();
	return refreshed.accessToken;
}

export async function listLanguages(_force = false): Promise<TranslationLanguage[]> {
	return TRANSLATION_LANGUAGES;
}

export async function translateText(text: string): Promise<string> {
	if (!text.trim()) {
		throw new Error('Message is empty.');
	}

	const requestBody = {
		q: text,
		source: getSourceLanguage(),
		target: getTargetLanguage(),
	};

	const requestOnce = async (token: string) =>
		fetch(`${getApiBaseUrl()}/translate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(requestBody),
		});

	let token = await getValidAccessToken();
	let response = await requestOnce(token);

	if (response.status === 401) {
		token = (await refreshSessionTokens()).accessToken;
		response = await requestOnce(token);
	}

	if (!response.ok) {
		const reason = await response.text().catch(() => 'translation failed');
		throw new Error(`Translate failed (${response.status}): ${reason}`);
	}

	const data = (await response.json()) as TranslationResponse;

	if ('translatedText' in data && typeof data.translatedText === 'string') {
		return data.translatedText;
	}

	if (
		'translations' in data &&
		Array.isArray(data.translations) &&
		data.translations.length > 0
	) {
		const first = data.translations[0];
		if (typeof first?.translatedText === 'string') return first.translatedText;
		if (typeof first?.text === 'string') return first.text;
	}

	throw new Error('Translation API returned an unexpected payload.');
}
