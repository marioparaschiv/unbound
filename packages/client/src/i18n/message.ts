// The SDK imports these from the plugin's generated `@unbound-app/i18n` (`generatedModules` in the SDK generator's config.ts).
import type { FormatVars as MessageVars, MessageKey } from '@unbound-app/i18n';

export type { MessageKey };

/** A value one ICU placeholder takes. */
export type MessageVarValue = string | number | boolean | Date;

/** Placeholder values by name, as a resolver receives them. */
export type LooseMessageVars = Record<string, MessageVarValue>;

/** A message key whose en-US text has no placeholders. */
export type PlainMessageKey = Exclude<MessageKey, keyof MessageVars>;

/** A message key whose en-US text has placeholders. */
export type VarsMessageKey = Extract<MessageKey, keyof MessageVars>;

/**
 * The arguments after a key, as `format(key, vars)` takes them: the key's placeholder values when it has
 * placeholders, none when it has none, then `Tail`.
 */
export type MessageArgs<
	K extends MessageKey,
	Tail extends unknown[] = [],
> = K extends keyof MessageVars ? [vars: MessageVars[K], ...Tail] : Tail;

/** An options field holding a key's placeholder values: required when the key has placeholders, absent otherwise. */
export type KeyVars<K extends MessageKey, Field extends string> = [K] extends [never]
	? { [P in Field]?: never }
	: K extends keyof MessageVars
		? { [P in Field]: MessageVars[K] }
		: { [P in Field]?: never };

/** Formats one message key in the active locale, falling back to en-US, then the key itself. */
export type ResolveMessage = (key: string, vars?: LooseMessageVars) => string;

/** How a caller's keys resolve: the formatter, and whether a key's text takes placeholder values. */
export type MessageLookup = {
	resolveMessage: ResolveMessage;
	/** Whether the key's message has placeholders, so the argument after it is its vars. */
	takesVars: (key: string) => boolean;
};

/**
 * @description Tells whether a message's text has an ICU placeholder, such as `{name}` or `{count, plural, …}`.
 * @param text The message text.
 * @returns Whether it has one.
 */
export function hasPlaceholders(text: string | undefined): boolean {
	return /\{\s*[\p{L}\p{N}_$]/u.test(text ?? '');
}

/** A shorthand's resolved key, and the arguments after it and its vars. */
export type TakenMessage = {
	text: string;
	rest: unknown[];
};

function isVars(value: unknown): value is LooseMessageVars {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Resolves the key that starts a shorthand's arguments, taking its vars when its message has
 * placeholders, since the types put them right after the key.
 * @param lookup Resolves the caller's keys.
 * @param key The key.
 * @param args The arguments after the key.
 * @returns The resolved text, and the arguments after the key and its vars.
 */
export function takeMessage(
	lookup: MessageLookup,
	key: string,
	args: readonly unknown[],
): TakenMessage {
	if (!lookup.takesVars(key)) {
		return { text: lookup.resolveMessage(key), rest: [...args] };
	}

	const [vars, ...rest] = args;

	return { text: lookup.resolveMessage(key, isVars(vars) ? vars : undefined), rest };
}

export default { hasPlaceholders, takeMessage };
