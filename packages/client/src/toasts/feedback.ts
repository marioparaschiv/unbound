import type { ToastHandle, ToastOptions } from '@unbound-app/types/toasts';
import type { AddonLogger } from '@unbound-app/types';

import { takeMessage, type MessageArgs, type MessageKey, type MessageLookup } from '~/i18n/message';

/** The look of a shorthand toast; each draws the icon Discord's help messages use for that tone. */
export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

/** The toast options a shorthand takes after its key and vars. */
export type ToastShorthandOptions = Pick<ToastOptions, 'icon' | 'duration' | 'id'>;

/** Shows a toast titled by a message key: `(key, vars?, options?)`, with vars exactly when the key has placeholders. */
export type MessageToast = <K extends MessageKey>(
	key: K,
	...args: MessageArgs<K, [options?: ToastShorthandOptions]>
) => ToastHandle;

/** Shows an error toast: a generic title for an error alone, or `(key, vars?, error, options?)`. */
export type ErrorToast = {
	(cause: unknown): ToastHandle;
	<K extends MessageKey>(
		key: K,
		...args: MessageArgs<K, [error: unknown, options?: ToastShorthandOptions]>
	): ToastHandle;
};

/** The toast shorthands, each one line with a localised title. */
export type FeedbackToasts = {
	success: MessageToast;
	info: MessageToast;
	warning: MessageToast;
	error: ErrorToast;
};

/** What the shorthands are built over: whose keys they resolve, where they log, and how they show. */
export type FeedbackToastsOptions = {
	/** Resolves the caller's message keys: a plugin's own, or Unbound's. */
	messages: MessageLookup;
	/** Resolves Unbound's keys, for the generic error title. */
	core: MessageLookup;
	/** Receives the error each `error` toast reports. */
	logger: Pick<AddonLogger, 'error'>;
	show: (options: ToastOptions) => ToastHandle;
};

/** The icon each variant draws, matching Discord's help message tones. */
export const VARIANT_ICONS: Record<ToastVariant, string> = {
	success: 'CircleCheckIcon',
	info: 'CircleInformationIcon',
	warning: 'WarningIcon',
	error: 'CircleXIcon',
};

const GENERIC_ERROR_TITLE = 'UNBOUND_SOMETHING_WENT_WRONG';

/**
 * @description Reads the text an error carries: an Error's message, a thrown string, or a `message` field.
 * @param cause What was thrown or rejected.
 * @returns The text, or `undefined` when the value carries none.
 */
export function errorText(cause: unknown): string | undefined {
	if (typeof cause === 'string') {
		return cause || undefined;
	}

	if (cause instanceof Error) {
		return cause.message || cause.name;
	}

	if (typeof cause === 'object' && cause !== null && 'message' in cause) {
		return typeof cause.message === 'string' && cause.message ? cause.message : undefined;
	}

	return undefined;
}

// Only the documented fields, so stray vars set nothing.
// UNKNOWN: untyped at runtime; only the key's message tells vars from options.
function pickOptions(value: unknown): ToastShorthandOptions {
	if (typeof value !== 'object' || value === null) {
		return {};
	}

	const { icon, duration, id } = value as ToastShorthandOptions;

	return {
		...(icon === undefined ? {} : { icon }),
		...(duration === undefined ? {} : { duration }),
		...(id === undefined ? {} : { id }),
	};
}

/**
 * @description Creates the toast shorthands over one caller's message keys.
 * @param options The caller's and core's lookups, the logger and the low-level `show`.
 * @returns `success`, `info`, `warning` and `error`.
 */
export function createFeedbackToasts({
	messages,
	core,
	logger,
	show,
}: FeedbackToastsOptions): FeedbackToasts {
	function variant(kind: ToastVariant): MessageToast {
		return (key, ...args) => {
			const { text, rest } = takeMessage(messages, key, args);

			return show({ icon: VARIANT_ICONS[kind], ...pickOptions(rest[0]), title: text });
		};
	}

	// One argument is always the error; with more, the first is the title key.
	function readError(args: unknown[]): [title: string, cause: unknown, options: unknown] {
		if (args.length === 1) {
			return [core.resolveMessage(GENERIC_ERROR_TITLE), args[0], undefined];
		}

		const { text, rest } = takeMessage(messages, String(args[0]), args.slice(1));

		return [text, rest[0], rest[1]];
	}

	function error(...args: unknown[]): ToastHandle {
		const [title, cause, options] = readError(args);

		logger.error(`${title}:`, cause);

		return show({
			icon: VARIANT_ICONS.error,
			...pickOptions(options),
			title,
			content: errorText(cause),
		});
	}

	return {
		success: variant('success'),
		info: variant('info'),
		warning: variant('warning'),
		error,
	};
}

export default { VARIANT_ICONS, errorText, createFeedbackToasts };
