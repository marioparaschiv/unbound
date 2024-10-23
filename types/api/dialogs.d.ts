import type { ReactElement } from 'react';

interface AlertProps {
	/**
	 * Key of the alert
	 * @default: uuid()
	 */
	key?: string;
	/**
	 * Title of the alert.
	 * @required
	 */
	title: string;
	/**
	 * Content in the alert.
	 * Can partially be a React Component however some things don't render.
	 * @optional
	 */
	content?: string | ReactElement;
	/**
	 * Extra content which renders in the `actions` prop above the button.
	 * If there is no `content` prop passed then this is rendered with no margin.
	 * @optional
	 */
	component?: ReactElement;
	/**
	 * Adds some extra margins to the custom component to be rendered.
	 * @default: true
	 */
	componentMargin?: boolean;
	/**
	 * Array of buttons that should be rendered under the content of the alert.
	 * @optional
	 */
	buttons?: {
		text: string;
		onPress?: Fn;
		variant?: string;
		/**
		 * Whether the button should close the alert when pressed.
		 * @default: true
		 */
		closeAlert?: boolean;
	}[];
	/**
	 * Whether to automatically add a `cancel` button.
	 * @default: true
	 */
	cancelButton?: boolean;

	/**
	 * Optional callback for the press of the `cancel` button
	 */
	onCancel?: Fn;
}
