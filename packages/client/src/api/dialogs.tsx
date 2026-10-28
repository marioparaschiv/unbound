import type { ComponentType, ReactNode } from 'react';
import uuid from '@unbound-app/utils/uuid';
import { Alert } from 'react-native';

import { Discord } from '~/api/metro/design';

export type DialogButtonVariant = 'primary' | 'secondary' | 'destructive';

export type DialogButton = {
	label: string;
	variant?: DialogButtonVariant;
	onPress?: () => void;
};

export type DialogContentProps = {
	dismiss: () => void;
};

export type AlertDialogProps = {
	title: string;
	body?: string;
	/** A component rendered below the body, given a way to close the dialog. */
	content?: ComponentType<DialogContentProps>;
	buttons?: DialogButton[];
	/** Adds a cancel button last; a string sets its label. */
	cancel?: boolean | string;
	/** Runs when the cancel button closes the dialog. */
	onCancel?: () => void;
};

export type DialogHandle = {
	key: string;
	dismiss: () => void;
};

export type ConfirmOptions = {
	title: string;
	body?: string;
	confirmLabel: string;
	cancelLabel?: string;
	destructive?: boolean;
};

const DEFAULT_CANCEL_LABEL = 'Cancel';
const open = new Set<string>();

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
		if (!open.delete(key)) return;

		Discord.dismissAlert?.(key);
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
	const extraContent: ReactNode = Content ? <Content dismiss={dismiss} /> : undefined;

	open.add(key);
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
 * @description Asks a yes-or-no question with a confirm and a cancel button.
 * @param options The question and the confirm button's label.
 * @returns Whether the user confirmed; closing the dialog any other way counts as no.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
	return new Promise((resolve) => {
		showDialog({
			title: options.title,
			body: options.body,
			buttons: [
				{
					label: options.confirmLabel,
					variant: options.destructive ? 'destructive' : 'primary',
					onPress: () => resolve(true),
				},
			],
			cancel: options.cancelLabel ?? true,
			onCancel: () => resolve(false),
		});
	});
}

/**
 * @description Closes every dialog this API opened.
 */
export function dismissAll() {
	for (const key of open) {
		open.delete(key);
		Discord.dismissAlert?.(key);
	}
}

/** Starts the dialogs API; it keeps no state until a dialog opens. */
export function start() {}

/** Closes any dialog still open. */
export function stop() {
	dismissAll();
}

export default { showDialog, confirm, dismissAll, start, stop };
