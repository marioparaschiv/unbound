import type { MessageLookup } from '~/i18n/message';

/** Where one owner's command text comes from: its en-US table, its active locale, and when that changes. */
export type CommandLocales = {
	/** The en-US message of a key, which the 1-100 character limit is checked on; `undefined` for an unknown key. */
	source(key: string): string | undefined;
	/** The message of a key in the user's locale, falling back to en-US. */
	text(key: string): string;
	/** Calls the listener when the locale changes or its translation loads; returns the remover. */
	subscribe(listener: () => void): () => void;
};

/**
 * @description Adapts an owner's en-US table and message lookup into the locales its commands read, so command
 * text resolves through the same `resolveMessage` as the owner's toasts and dialogs.
 * @param source The en-US messages.
 * @param lookup Resolves a key in the active locale.
 * @param subscribe Follows locale changes and translation loads.
 * @returns The command locales.
 */
export function createCommandLocales(
	source: Readonly<Record<string, string>>,
	lookup: MessageLookup,
	subscribe: CommandLocales['subscribe'],
): CommandLocales {
	return {
		source: (key) => (Object.hasOwn(source, key) ? source[key] : undefined),
		text: (key) => lookup.resolveMessage(key),
		subscribe,
	};
}
