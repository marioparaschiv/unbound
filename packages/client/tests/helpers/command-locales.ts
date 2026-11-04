import type { CommandMessageKey } from '@unbound-app/types/commands';

import { createCommandLocales } from '~/commands/locales';
import type { CommandLocales } from '~/commands/locales';

/**
 * @description Types a test's own key as a message key; the client's keys are Unbound's core ones.
 * @param text The key, used with {@link anyKeyLocales} or a {@link createTestLocales} table.
 * @returns The key.
 */
export function key(text: string): CommandMessageKey {
	return text as CommandMessageKey;
}

function identity(text: string) {
	return text;
}

function ignore() {
	return () => {};
}

/** Locales whose every string is a key with itself as its en-US text, for tests about anything but text. */
export const anyKeyLocales: CommandLocales = {
	source: identity,
	text: identity,
	subscribe: ignore,
};

/** Command locales over in-memory tables, switched with `setLocale` as Discord's locale change would. */
export type TestLocales = CommandLocales & {
	setLocale(code: string): void;
	listeners(): number;
};

/**
 * @description Creates command locales over one table per locale code; `en-US` is the source table.
 * @param tables The messages of each locale.
 * @returns The locales, starting in en-US.
 */
export function createTestLocales(tables: Record<string, Record<string, string>>): TestLocales {
	const listeners = new Set<() => void>();
	let locale = 'en-US';
	const source = tables['en-US'] ?? {};
	const lookup = {
		resolveMessage: (text: string) => tables[locale]?.[text] ?? source[text] ?? text,
		takesVars: () => false,
	};
	const locales = createCommandLocales(source, lookup, (listener) => {
		listeners.add(listener);

		return () => void listeners.delete(listener);
	});

	return {
		...locales,
		setLocale(code) {
			locale = code;

			for (const listener of listeners) listener();
		},
		listeners: () => listeners.size,
	};
}
