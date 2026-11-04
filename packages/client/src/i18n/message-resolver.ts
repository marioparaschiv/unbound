import { createLogger } from '@unbound-app/logger';

import { createCommandLocales, type CommandLocales } from '~/commands/locales';
import type { LooseMessageVars, MessageLookup } from '~/i18n/message';
import type { AddonLocales } from '~/i18n/addon-locales';
import { hasPlaceholders } from '~/i18n/message';

/** One plugin's message lookup, shared by its toasts, dialogs and commands. */
export type MessageResolver = MessageLookup & {
	/** The command text over the same lookup, once the plugin created its locales; `undefined` before. */
	commandLocales: () => CommandLocales | undefined;
};

/**
 * @description Creates the one lookup a plugin's scope shares between its keyed APIs (toasts, dialogs, commands):
 * `resolveMessage(key, vars)` and `takesVars(key)`. Until the plugin creates its locales, a key shows as itself
 * and one warning names the plugin.
 * @param owner The plugin id, named in the warning.
 * @param getLocales Reads the locales the plugin's `@unbound-app/i18n` module created.
 * @returns The resolver.
 */
export function createMessageResolver(
	owner: string,
	getLocales: () => AddonLocales | undefined,
): MessageResolver {
	const logger = createLogger('i18n', owner);
	let warned = false;

	function resolveMessage(key: string, vars?: LooseMessageVars) {
		const locales = getLocales();

		if (locales) {
			return locales.format(key, vars);
		}

		if (!warned) {
			warned = true;
			logger.warn(
				`Failed to resolve message ${key} for ${owner}: the plugin has no locales yet.`,
			);
		}

		return key;
	}

	// en-US decides the placeholders, as the generated typings do.
	const resolver: MessageResolver = {
		resolveMessage,
		takesVars: (key) => hasPlaceholders(getLocales()?.source[key]),
		commandLocales() {
			const locales = getLocales();

			return locales && createCommandLocales(locales.source, resolver, locales.subscribe);
		},
	};

	return resolver;
}

export default { createMessageResolver };
