import type {
	KeyVars,
	LooseMessageVars,
	MessageKey,
	MessageLookup,
	PlainMessageKey,
	VarsMessageKey,
} from '~/i18n/message';
import type { AlertDialogProps, DialogHandle } from '~/dialogs/api';

/** The optional body key of a dialog, and its vars when the message has placeholders. */
type BodyOptions<B extends MessageKey> = {
	/** The key of the text shown below the title. */
	body?: B;
} & KeyVars<B, 'bodyVars'>;

/** What `confirm` asks after its title key: the body and button keys, and the title's and body's vars. */
export type ConfirmOptions<T extends MessageKey, B extends MessageKey = never> = BodyOptions<B> &
	KeyVars<T, 'titleVars'> & {
		/** The key of the button that resolves `true`. */
		confirm: PlainMessageKey;
		/** The key of the button that resolves `false`; Unbound's `Cancel` when omitted. */
		cancel?: PlainMessageKey;
		/** Styles the confirm button as `destructive` instead of `primary`. Use it whenever confirming loses data. */
		destructive?: boolean;
	};

/** What `alert` shows after its title key: the body and button keys, and the title's and body's vars. */
export type AlertOptions<T extends MessageKey, B extends MessageKey = never> = BodyOptions<B> &
	KeyVars<T, 'titleVars'> & {
		/** The key of the button that closes the dialog; Unbound's `OK` when omitted. */
		confirm?: PlainMessageKey;
	};

/** Asks a yes-or-no question titled by a message key. */
export type ConfirmDialog = <T extends MessageKey, B extends MessageKey = never>(
	title: T,
	options: ConfirmOptions<T, B>,
) => Promise<boolean>;

/** Tells the user something in a dialog titled by a message key; `options` is required when the title has vars. */
export type AlertDialog = {
	<T extends PlainMessageKey, B extends MessageKey = never>(
		title: T,
		options?: AlertOptions<T, B>,
	): Promise<void>;
	<T extends VarsMessageKey, B extends MessageKey = never>(
		title: T,
		options: AlertOptions<T, B>,
	): Promise<void>;
};

/** A yes-or-no question with its text already resolved, for one composed at runtime. */
export type ConfirmTextOptions = {
	title: string;
	body?: string;
	confirm: string;
	cancel: string;
	destructive?: boolean;
};

/** The dialog shorthands, resolving each key through one caller's locales. */
export type FeedbackDialogs = {
	confirm: ConfirmDialog;
	alert: AlertDialog;
};

type ShowDialog = (options: AlertDialogProps) => DialogHandle;

/** What the shorthands are built over: whose keys they resolve, and how they open a dialog. */
export type FeedbackDialogsOptions = {
	/** Resolves the caller's message keys: a plugin's own, or Unbound's. */
	messages: MessageLookup;
	/** Resolves Unbound's keys, for the default `Cancel` and `OK` labels. */
	core: MessageLookup;
	/** Opens the built dialog. */
	showDialog: ShowDialog;
};

/** A dialog shorthand's options as the runtime reads them, whatever keys and vars the types allowed. */
export type DialogReadOptions = {
	body?: string;
	bodyVars?: LooseMessageVars;
	titleVars?: LooseMessageVars;
	confirm?: string;
	cancel?: string;
	destructive?: boolean;
};

/**
 * @description Asks a yes-or-no question whose text is already resolved.
 * @param showDialog Opens the dialog.
 * @param options The resolved question and button labels.
 * @returns `true` on the confirm button; `false` on cancel, the backdrop, the back gesture or a dismiss.
 */
export function confirmText(showDialog: ShowDialog, options: ConfirmTextOptions): Promise<boolean> {
	return new Promise((resolve) => {
		showDialog({
			title: options.title,
			body: options.body,
			buttons: [
				{
					label: options.confirm,
					variant: options.destructive ? 'destructive' : 'primary',
					onPress: () => resolve(true),
				},
			],
			cancel: options.cancel,
			onCancel: () => resolve(false),
			onDismiss: () => resolve(false),
		});
	});
}

/**
 * @description Creates the dialog shorthands over one caller's message keys.
 * @param options The caller's and core's lookups, and the low-level `showDialog`.
 * @returns `confirm` and `alert`.
 */
export function createFeedbackDialogs({
	messages,
	core,
	showDialog,
}: FeedbackDialogsOptions): FeedbackDialogs {
	const resolve = (key: string | undefined, vars?: LooseMessageVars) =>
		key === undefined ? undefined : messages.resolveMessage(key, vars);

	function confirm(title: string, options: DialogReadOptions): Promise<boolean> {
		return confirmText(showDialog, {
			title: messages.resolveMessage(title, options.titleVars),
			body: resolve(options.body, options.bodyVars),
			confirm: resolve(options.confirm) ?? '',
			cancel: resolve(options.cancel) ?? core.resolveMessage('UNBOUND_CANCEL'),
			destructive: options.destructive,
		});
	}

	function alert(title: string, options: DialogReadOptions = {}): Promise<void> {
		return new Promise((settle) => {
			showDialog({
				title: messages.resolveMessage(title, options.titleVars),
				body: resolve(options.body, options.bodyVars),
				buttons: [
					{
						label: resolve(options.confirm) ?? core.resolveMessage('UNBOUND_OK'),
						onPress: () => settle(),
					},
				],
				onDismiss: () => settle(),
			});
		});
	}

	return {
		confirm,
		alert,
	};
}
