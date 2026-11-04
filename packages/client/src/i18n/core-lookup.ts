import type { MessageLookup } from '~/i18n/message';
import { hasPlaceholders } from '~/i18n/message';
import { format, messages } from '~/i18n/api';

/** Resolves Unbound's own keys, for core callers and for the shorthands' default labels and titles. */
export const coreMessages: MessageLookup = {
	resolveMessage: format,
	/**
	 * @description Tells whether a core key's message has placeholders.
	 * @param key The core message key.
	 * @returns Whether the argument after the key is its vars.
	 */
	takesVars: (key) => hasPlaceholders(messages[key]),
};

export default coreMessages;
