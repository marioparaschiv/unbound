import type { AlertDialogProps, DialogHandle } from '../src/dialogs';
import type { ToastHandle, ToastOptions } from '../src/toasts';
import type { IcuVars } from './icu-format';

import { parseIcu } from './icu-parse';

/** How the fakes resolve a plugin's message keys, as the client's scoped `resolveMessage` does. */
export type FakeMessageLookup = {
	resolveMessage: (key: string, vars?: IcuVars) => string;
	/** Whether the key's en-US message has placeholders, so the argument after it is its vars. */
	takesVars: (key: string) => boolean;
};

/** A toast a plugin showed: its options, and the key and vars of a shorthand's title. */
export type ShownToast = ToastOptions & { key?: string; vars?: IcuVars };

/** The fake `toasts`: each toast shown is recorded in `shown`, and its handle's `update` edits the record. */
export type FakeToasts = {
	shown: ShownToast[];
	show: (options: ToastOptions) => ToastHandle;
	success: (key: string, ...args: unknown[]) => ToastHandle;
	info: (key: string, ...args: unknown[]) => ToastHandle;
	warning: (key: string, ...args: unknown[]) => ToastHandle;
	error: (...args: unknown[]) => ToastHandle;
};

/** What `confirm` and `alert` take after their title key. */
export type DialogShorthandOptions = {
	titleVars?: IcuVars;
	body?: string;
	bodyVars?: IcuVars;
	confirm?: string;
	cancel?: string;
	destructive?: boolean;
};

/** A dialog a plugin opened, and how a test answers it. */
export type OpenedDialog = {
	kind: 'dialog' | 'confirm' | 'alert';
	/** The title as shown, resolved from its key for `confirm` and `alert`. */
	title: string;
	body: string | undefined;
	/** The title's message key, for `confirm` and `alert`. */
	key: string | undefined;
	options: AlertDialogProps | DialogShorthandOptions;
	/** Whether it is still showing. */
	open: boolean;
	/**
	 * Answers it: `true` confirms or presses the first button, `false` cancels, and a string presses the button with
	 * that label.
	 */
	respond: (answer: boolean | string) => void;
};

/** The fake `dialogs`: each dialog opened is recorded in `opened`, to `respond` to. */
export type FakeDialogs = {
	opened: OpenedDialog[];
	showDialog: (options: AlertDialogProps) => DialogHandle;
	confirm: (key: string, options: DialogShorthandOptions) => Promise<boolean>;
	alert: (key: string, options?: DialogShorthandOptions) => Promise<void>;
	dismissAll: () => void;
	start: () => void;
	stop: () => void;
};

/** Keys shown as themselves, for a plugin without `i18n/en-US.json`. */
export const KEY_LOOKUP: FakeMessageLookup = {
	/**
	 * @description Shows a key as itself.
	 * @param key The message key.
	 * @returns The key.
	 */
	resolveMessage: (key) => key,
	/**
	 * @description Says no key has placeholders, since there is no en-US file to read them from.
	 * @returns `false`.
	 */
	takesVars: () => false,
};

// Unbound's own labels the shorthands fall back to, in en-US.
const CORE = { ok: 'OK', errorTitle: 'Something went wrong' };

/**
 * @description Tells whether a message has a placeholder, as the client decides whether a key takes vars.
 * @param message The en-US message, if the key has one.
 * @returns Whether it has an argument, plural or select.
 */
export function hasPlaceholders(message: string | undefined): boolean {
	return message !== undefined && parseIcu(message).some((node) => node.kind !== 'text');
}

function isVars(value: unknown): value is IcuVars {
	return typeof value === 'object' && value !== null && !(value instanceof Error);
}

// The key's vars come right after it when its message has placeholders, as the typings order them.
// UNKNOWN: a shorthand's arguments after its key are vars, options or an error, which this sorts out.
function takeMessage(lookup: FakeMessageLookup, key: string, args: readonly unknown[]) {
	if (!lookup.takesVars(key)) {
		return { key, vars: undefined, text: lookup.resolveMessage(key), rest: [...args] };
	}

	const [first, ...rest] = args;
	const vars = isVars(first) ? first : undefined;

	return { key, vars, text: lookup.resolveMessage(key, vars), rest };
}

// UNKNOWN: the argument after a shorthand's vars is its options, or nothing.
function pickOptions(value: unknown): Partial<ToastOptions> {
	return isVars(value) ? value : {};
}

function errorText(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

/**
 * @description Creates the fake `toasts`, whose shorthands resolve keys through `lookup` as the client's do.
 * @param lookup Reads the plugin's keys; called on each toast, so it may change after creation.
 * @returns The toasts.
 */
export function createFakeToasts(lookup: () => FakeMessageLookup = () => KEY_LOOKUP): FakeToasts {
	const shown: ShownToast[] = [];

	function show(options: ShownToast): ToastHandle {
		const record = { ...options };

		shown.push(record);

		return { update: (next) => void Object.assign(record, next), close: () => {} };
	}

	function variant(key: string, ...args: unknown[]) {
		const { text, vars, rest } = takeMessage(lookup(), key, args);

		return show({ ...pickOptions(rest[0]), title: text, key, vars });
	}

	// One argument is always the error; with more, the first is the title key.
	function error(...args: unknown[]) {
		if (args.length === 1) {
			return show({ title: CORE.errorTitle, content: errorText(args[0]) });
		}

		const { text, vars, rest } = takeMessage(lookup(), String(args[0]), args.slice(1));

		return show({
			...pickOptions(rest[1]),
			title: text,
			content: errorText(rest[0]),
			key: String(args[0]),
			vars,
		});
	}

	return { shown, show, success: variant, info: variant, warning: variant, error };
}

/**
 * @description Creates the fake `dialogs`, whose `confirm` and `alert` resolve keys through `lookup`.
 * @param lookup Reads the plugin's keys; called on each dialog, so it may change after creation.
 * @returns The dialogs.
 */
export function createFakeDialogs(lookup: () => FakeMessageLookup = () => KEY_LOOKUP): FakeDialogs {
	const opened: OpenedDialog[] = [];

	function open(
		dialog: Omit<OpenedDialog, 'open' | 'respond'>,
		answer: (value: boolean | string) => void,
	) {
		const record: OpenedDialog = {
			...dialog,
			open: true,
			respond(value) {
				if (!record.open) {
					throw new Error(`Failed to respond to dialog "${record.title}": it is closed.`);
				}

				record.open = false;
				answer(value);
			},
		};

		opened.push(record);

		return record;
	}

	function resolve(key: string | undefined, vars?: IcuVars) {
		return key === undefined ? undefined : lookup().resolveMessage(key, vars);
	}

	function dismissAll() {
		for (const dialog of opened)
			if (dialog.open) {
				dialog.respond(false);
			}
	}

	return {
		opened,
		showDialog(options) {
			const record = open(
				{ kind: 'dialog', title: options.title, body: options.body, key: void 0, options },
				(answer) => {
					const buttons = options.buttons ?? [];
					const pressed =
						typeof answer === 'string'
							? buttons.find((button) => button.label === answer)
							: answer
								? buttons[0]
								: void 0;

					if (pressed) {
						pressed.onPress?.();
					} else {
						options.onCancel?.();
					}
				},
			);

			return {
				key: `unbound-dialog-${opened.length}`,
				dismiss: () => void (record.open = false),
			};
		},
		confirm: (key, options) =>
			new Promise((done) => {
				const confirm = resolve(options.confirm) ?? CORE.ok;
				const dialog = {
					kind: 'confirm' as const,
					title: resolve(key, options.titleVars) ?? key,
					body: resolve(options.body, options.bodyVars),
					key,
					options,
				};

				open(dialog, (answer) => done(answer === true || answer === confirm));
			}),
		alert: (key, options = {}) =>
			new Promise((done) => {
				const dialog = {
					kind: 'alert' as const,
					title: resolve(key, options.titleVars) ?? key,
					body: resolve(options.body, options.bodyVars),
					key,
					options,
				};

				open(dialog, () => done());
			}),
		dismissAll,
		start: () => {},
		stop: dismissAll,
	};
}
