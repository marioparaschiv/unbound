import type { FormatVars, LocaleStrings } from '~/i18n/locale-strings';
import { findByName } from '~/metro/search';

type MessageFormatInstance = {
	format: (vars?: FormatVars) => string;
};

type MessageFormatConstructor = new (message: string) => MessageFormatInstance;

let MessageFormat: MessageFormatConstructor | undefined;

/**
 * @description Resolves and memoises the `MessageFormat` constructor. Uses `findByName` (which unwraps
 * the module's default export) because the value is used with `new`; a lazy proxy cannot be constructed.
 * @returns The `MessageFormat` constructor.
 */
function getMessageFormat() {
	MessageFormat ??= findByName('MessageFormat');

	return MessageFormat;
}

/**
 * @description Formats one message read from a messages proxy with Discord's ICU `MessageFormat`.
 * @param messages The proxy to read the message from.
 * @param key The message key.
 * @param vars The values of the message's placeholders.
 * @returns The formatted message, or the raw message before `MessageFormat` loads.
 */
export function formatWith(messages: LocaleStrings, key: string, vars?: FormatVars): string {
	const Format = getMessageFormat();

	if (!Format) {
		return messages[key];
	}

	return new Format(messages[key]).format(vars);
}

export default { formatWith };
