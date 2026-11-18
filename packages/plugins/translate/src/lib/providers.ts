import { format, messages } from '@unbound-app/i18n';

export type ServiceTranslation = { text: string; detected?: string };

export type AnonymousService = 'google' | 'mymemory';

export type ServiceChoice = 'auto' | 'unbound' | AnonymousService;

type Request = { text: string; source: string; target: string };

const GOOGLE_URL = 'https://clients5.google.com/translate_a/t';
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const MYMEMORY_AUTO = 'autodetect';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}

/**
 * @description Picks the services a translation tries, in order: Automatic uses Unbound's once signed in, and otherwise
 * Google, then MyMemory if Google fails.
 * @param choice The user's choice.
 * @param signedIn Whether the user connected their Discord account.
 * @returns The services to try.
 */
export function servicesToTry(
	choice: ServiceChoice,
	signedIn: boolean,
): ['unbound'] | AnonymousService[] {
	if (choice === 'unbound' || (choice === 'auto' && signedIn)) return ['unbound'];

	return choice === 'auto' ? ['google', 'mymemory'] : [choice];
}

/**
 * @description Reads Google's anonymous answer: `[[translation, detected]]` from `translate_a/t`, or sentence pairs then the
 * detected language from `translate_a/single`.
 * @param payload The parsed response.
 * @returns The translation, or `undefined` when the answer has none.
 */
export function readGoogle(payload: unknown): ServiceTranslation | undefined {
	if (!Array.isArray(payload)) return undefined;

	const [first] = payload as unknown[];

	if (typeof first === 'string') return { text: first };

	if (Array.isArray(first) && typeof first[0] === 'string') {
		return { text: first[0], detected: text(first[1]) };
	}

	if (!Array.isArray(first)) return undefined;

	const sentences = (first as unknown[]).flatMap((pair) =>
		Array.isArray(pair) && typeof pair[0] === 'string' ? [pair[0]] : [],
	);

	return sentences.length ? { text: sentences.join(''), detected: text(payload[2]) } : undefined;
}

/**
 * @description Reads a MyMemory answer, which reports failures with a non-200 `responseStatus` in a 200 response.
 * @param payload The parsed response.
 * @returns The translation, or `undefined` when the answer has none.
 */
export function readMyMemory(payload: unknown): ServiceTranslation | undefined {
	if (!isRecord(payload) || Number(payload.responseStatus) !== 200) return undefined;

	const data = isRecord(payload.responseData) ? payload.responseData : {};
	const translation = text(data.translatedText);

	return translation ? { text: translation, detected: text(data.detectedLanguage) } : undefined;
}

/**
 * @description Builds the request URL for a service that needs no account.
 * @param service The service.
 * @param request The text and the language codes, `auto` to detect the source.
 * @returns The URL to fetch.
 */
export function serviceUrl(service: AnonymousService, { text, source, target }: Request): string {
	const query = encodeURIComponent(text);

	if (service === 'google') {
		return `${GOOGLE_URL}?client=dict-chrome-ex&sl=${source}&tl=${target}&q=${query}`;
	}

	const pair = encodeURIComponent(`${source === 'auto' ? MYMEMORY_AUTO : source}|${target}`);

	return `${MYMEMORY_URL}?langpair=${pair}&q=${query}`;
}

const READERS: Record<AnonymousService, (payload: unknown) => ServiceTranslation | undefined> = {
	google: readGoogle,
	mymemory: readMyMemory,
};

async function translateAnonymously(
	service: AnonymousService,
	request: Request,
): Promise<ServiceTranslation> {
	const response = await fetch(serviceUrl(service, request));

	if (!response.ok) {
		throw new Error(format('SERVICE_FAILED', { status: response.status }));
	}

	const translation = READERS[service](await response.json());

	if (!translation) throw new Error(messages.TRANSLATE_INVALID_PAYLOAD);

	return translation;
}

/**
 * @description Translates through the first service that needs no account and answers.
 * @param services The services, in order.
 * @param request The text and the language codes.
 * @returns The translation, or throws the last service's error.
 */
export async function translateWithFallback(
	services: AnonymousService[],
	request: Request,
): Promise<ServiceTranslation> {
	let failure: unknown = new Error(messages.TRANSLATE_INVALID_PAYLOAD);

	for (const service of services) {
		try {
			return await translateAnonymously(service, request);
		} catch (error) {
			failure = error;
		}
	}

	throw failure;
}
