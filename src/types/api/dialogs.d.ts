export interface ConfirmationAlertOptions {
	title?: string;
	content: string | JSX.Element | JSX.Element[];
	confirmText?: string;

	/* TODO: ButtonColors */
	confirmColor?: any;
	onConfirm: () => void;
	cancelText?: string;
}


export interface InternalConfirmationAlertOptions extends Omit<ConfirmationAlertOptions, 'content'> {
	content: JSX.Element | JSX.Element[] | string | undefined;
	children: JSX.Element | JSX.Element[];
	body: string | JSX.Element[] | undefined;
}