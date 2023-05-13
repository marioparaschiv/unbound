import { createLogger } from '@logger';
import { i18n } from '@metro/common';
import Strings from '../i18n';

type LocaleStrings = Record<string, Record<string, any>>;

const Logger = createLogger('Components');

export const state = {
	locale: 'en-US',
	messages: {}
};

function initialize() {
	state.locale = i18n.getLocale() ?? 'en-US';
	i18n.on('locale', onChange);

	// Add core strings
	add(Strings);
}

export function add(strings: LocaleStrings) {
	if (typeof strings !== 'object' || Array.isArray(strings)) {
		throw new Error('Locale strings must be an object with languages and strings.');
	}

	for (const locale in strings) {
		addStrings(locale, strings[locale]);
	}

	return {
		remove: () => {
			const context = i18n._provider._context;

			for (const locale in strings) {
				for (const message of Object.keys(strings[locale])) {
					delete context.defaultMessages[message];
					delete context.messages[message];
					delete i18n.Messages[message];
				}
			}
		}
	};
};

function addStrings(locale: string, strings: LocaleStrings) {
	if (!state.locale) return;

	state.messages[locale] ??= {};
	Object.assign(state.messages[locale], strings);

	i18n.loadPromise.then(inject);
}

function inject() {
	if (!state.locale || !i18n?.getLocale) return;

	const context = i18n._provider._context;

	Object.assign(context.messages, state.messages[state.locale] ?? {});
	Object.assign(context.defaultMessages, state.messages['en-US'] ?? {});
}

async function onChange(locale) {
	state.locale = locale;

	await i18n.loadPromise;
	inject();
}

try {
	initialize();
} catch (e) {
	Logger.error('Failed to initialize i18n:', e.message);
}