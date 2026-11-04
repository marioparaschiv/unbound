import type { ComponentType, ReactNode } from 'react';
import uuid from '@unbound-app/utils/uuid';
import { Alert } from 'react-native';

import type { AlertOptions, ConfirmOptions, DialogReadOptions } from '~/dialogs/feedback';
import type { MessageKey, PlainMessageKey, VarsMessageKey } from '~/i18n/message';
import DialogCloseWatcher from '~/dialogs/dialog-close-watcher';
import { createFeedbackDialogs } from '~/dialogs/feedback';
import { coreMessages } from '~/i18n/core-lookup';
import { Discord } from '~/metro/design';

/** A dialog button's style; the system alert fallback only distinguishes `destructive`. */
export type DialogButtonVariant = 'primary' | 'secondary' | 'destructive';

/** One action button in a dialog opened by {@link showDialog}. */
export type DialogButton = {
	/** The text shown on the button. */
	label: string;
	/** The button's style; `primary` when omitted. */
	variant?: DialogButtonVariant;
	/** Runs after the press closes the dialog. */
	onPress?: () => void;
};

/** The props a dialog's custom `content` component receives. */
export type DialogContentProps = {
	/** Closes the dialog without running any button's handler. */
	dismiss: () => void;
};

/** What {@link showDialog} shows: a title, an optional body and custom content, and buttons. */
export type AlertDialogProps = {
	/** The heading at the top of the dialog. */
	title: string;
	/** Text shown below the title. */
	body?: string;
	/** A component rendered below the body, given a way to close the dialog. */
	content?: ComponentType<DialogContentProps>;
	/** The action buttons, in order, before the cancel button. */
	buttons?: DialogButton[];
	/** Adds a cancel button last; a string sets its label. */
	cancel?: boolean | string;
	/** Runs when the cancel button closes the dialog. */
	onCancel?: () => void;
	/** Runs when the dialog closes without a button: the backdrop, the back gesture, or its handle's `dismiss`. */
	onDismiss?: () => void;
};

/** An open dialog, as {@link showDialog} returns it. */
export type DialogHandle = {
	/** The `unbound-dialog-<uuid>` key the dialog was opened under in Discord's alert stack. */
	key: string;
	/** Closes the dialog; does nothing once it is closed or when the system alert fallback showed it. */
	dismiss: () => void;
};

const DEFAULT_CANCEL_LABEL = 'Cancel';
// Each open dialog's key, mapped to what runs when it closes without a button.
const open = new Map<string, (() => void) | undefined>();
const feedback = createFeedbackDialogs({ messages: coreMessages, core: coreMessages, showDialog });

function closeWithoutButton(key: string) {
	if (!open.has(key)) return;

	const onDismiss = open.get(key);

	open.delete(key);
	onDismiss?.();
}

function allButtons(options: AlertDialogProps): DialogButton[] {
	const buttons = [...(options.buttons ?? [])];

	if (options.cancel) {
		buttons.push({
			label: typeof options.cancel === 'string' ? options.cancel : DEFAULT_CANCEL_LABEL,
			variant: 'secondary',
			onPress: options.onCancel,
		});
	}

	return buttons;
}

function nativeStyle(
	button: DialogButton,
	isCancel: boolean,
): 'default' | 'cancel' | 'destructive' {
	if (isCancel) {
		return 'cancel';
	}

	return button.variant === 'destructive' ? 'destructive' : 'default';
}

function showNativeAlert(options: AlertDialogProps, buttons: DialogButton[]) {
	Alert.alert(
		options.title,
		options.body,
		buttons.map((button, index) => ({
			text: button.label,
			style: nativeStyle(button, Boolean(options.cancel) && index === buttons.length - 1),
			onPress: button.onPress,
		})),
		options.onDismiss ? { cancelable: true, onDismiss: options.onDismiss } : undefined,
	);
}

/**
 * @description Opens a dialog with Discord's own alert: a title, an optional body and custom component,
 * and action buttons, each of which closes the dialog before running its handler. On a Discord build
 * without the alert it falls back to the system alert, which shows the title, body and buttons only.
 * @param options The dialog's content and buttons.
 * @returns The dialog's key and a function that closes it.
 */
export function showDialog(options: AlertDialogProps): DialogHandle {
	const key = `unbound-dialog-${uuid()}`;
	const buttons = allButtons(options);

	function dismiss() {
		if (!open.has(key)) return;

		Discord.dismissAlert?.(key);
		closeWithoutButton(key);
	}

	// A press may unmount the dialog before its handler runs; waiting a microtask lets the press claim the key first.
	function handleUnmount() {
		void Promise.resolve().then(() => closeWithoutButton(key));
	}

	if (
		typeof Discord.openAlert !== 'function' ||
		!Discord.AlertModal ||
		!Discord.AlertActionButton
	) {
		showNativeAlert(options, buttons);

		return { key, dismiss: () => undefined };
	}

	const { AlertModal, AlertActionButton } = Discord;
	const Content = options.content;
	const extraContent: ReactNode = (
		<>
			{Content ? <Content dismiss={dismiss} /> : null}
			<DialogCloseWatcher onClose={handleUnmount} />
		</>
	);

	open.set(key, options.onDismiss);
	Discord.openAlert(
		key,
		<AlertModal
			title={options.title}
			content={options.body}
			extraContent={extraContent}
			actions={
				<>
					{buttons.map((button, index) => (
						<AlertActionButton
							key={`${index}-${button.label}`}
							text={button.label}
							variant={button.variant ?? 'primary'}
							onPress={() => {
								open.delete(key);
								button.onPress?.();
							}}
						/>
					))}
				</>
			}
		/>,
	);

	return { key, dismiss };
}

/**
 * @description Asks a yes-or-no question with a confirm and a cancel button, each text a message key.
 * @template T The title's key.
 * @template B The body's key.
 * @param title The question's message key.
 * @param options The `body`, `confirm` and `cancel` keys, `titleVars` and `bodyVars` for keys with placeholders, and `destructive`.
 * @returns Whether the user confirmed; cancel, the backdrop, the back gesture or a dismiss resolve `false`.
 */
export function confirm<T extends MessageKey, B extends MessageKey = never>(
	title: T,
	options: ConfirmOptions<T, B>,
): Promise<boolean> {
	return feedback.confirm(title, options);
}

/**
 * @description Tells the user something in a dialog with one button, each text a message key.
 * @template T The title's key.
 * @template B The body's key.
 * @param title The dialog's message key.
 * @param options The `body` and `confirm` keys, and `titleVars` and `bodyVars` for keys with placeholders.
 * @returns A promise that resolves once the dialog closes, however it closes.
 */
export function alert<T extends PlainMessageKey, B extends MessageKey = never>(
	title: T,
	options?: AlertOptions<T, B>,
): Promise<void>;
/**
 * @description Tells the user something in a dialog with one button, titled by a key with placeholders.
 * @template T The title's key.
 * @template B The body's key.
 * @param title The dialog's message key.
 * @param options `titleVars`, then the `body` and `confirm` keys, and `bodyVars` for a body with placeholders.
 * @returns A promise that resolves once the dialog closes, however it closes.
 */
export function alert<T extends VarsMessageKey, B extends MessageKey = never>(
	title: T,
	options: AlertOptions<T, B>,
): Promise<void>;
export function alert(title: MessageKey, options?: DialogReadOptions): Promise<void> {
	return Reflect.apply(feedback.alert, undefined, [title, options]);
}

/**
 * @description Closes every dialog this API opened, running each one's `onDismiss`.
 */
export function dismissAll() {
	// Deleting the current entry while iterating a Map is safe; the loop moves on to the next.
	for (const key of open.keys()) {
		Discord.dismissAlert?.(key);
		closeWithoutButton(key);
	}
}

/**
 * Starts the dialogs API; it keeps no state until a dialog opens.
 * @internal
 */
export function start() {}

/**
 * Closes any dialog still open.
 * @internal
 */
export function stop() {
	dismissAll();
}

export default { showDialog, confirm, alert, dismissAll, start, stop };
