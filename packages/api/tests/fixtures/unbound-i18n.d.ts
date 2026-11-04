// What ubd generates for a plugin whose en-US.json has these keys, from `localeTypings`.

declare module '@unbound-app/i18n' {
	/** Every en-US message, read in the user's locale. */
	export type Messages = {
		/** Flip a coin */
		readonly COIN_FLIP: string;
		/** The side to call */
		readonly COIN_SIDE: string;
		/** Heads */
		readonly COIN_HEADS: string;
		/** Tails */
		readonly COIN_TAILS: string;
		/** Saved */
		readonly SAVED: string;
		/** Starred {name} */
		readonly STARRED: string;
		/** {count, plural, one {# item saved} other {# items saved}} */
		readonly SAVED_N: string;
		/** Delete {name}? */
		readonly DELETE_TITLE: string;
		/** This cannot be undone. */
		readonly DELETE_BODY: string;
		/** Delete */
		readonly DELETE: string;
	};

	/** The placeholder values each message that has placeholders takes. */
	export type FormatVars = {
		STARRED: { name: string | number };
		SAVED_N: { count: number };
		DELETE_TITLE: { name: string | number };
	};

	/** Each message in the user's locale, falling back to en-US. */
	export const messages: Messages;
	/** Formats a message that has no placeholders. */
	export function format(key: Exclude<keyof Messages, keyof FormatVars>): string;
	/** Formats a message, filling its placeholders from `vars`. */
	export function format<K extends keyof FormatVars>(key: K, vars: FormatVars[K]): string;
	/**
	 * Re-renders the component when the user's locale changes or its translation loads, and returns the locale code.
	 * The build adds it to components and hooks that read `messages` or `format`.
	 */
	export function useMessages(): string;

	/** Every key of the plugin's en-US.json. */
	export type MessageKey = keyof Messages;

	global {
		/** Gives the plugin's commands, toasts and dialogs its message keys. */
		// oxlint-disable-next-line typescript/consistent-type-definitions -- merging needs an interface.
		interface UnboundMessageKeys extends Record<MessageKey, true> {}
	}
}
