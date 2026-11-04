import type { ReactElement } from 'react';

import { confirmText } from '~/dialogs/feedback';
import { Discord } from '~/metro/components';
import { showDialog } from '~/dialogs/api';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

/** Props for `ButtonRow`. */
export type ButtonRowProps = {
	/** The row's label. */
	label: string;
	/** Text shown under the label; none when omitted. */
	subLabel?: string;
	/** `danger` draws the row red, for something that cannot be undone. */
	variant?: 'button' | 'danger';
	/** A question asked before `onPress` runs; none when omitted. */
	confirmation?: string;
	disabled?: boolean;
	/** Called when the row is pressed, after the user confirms. */
	onPress: () => void;
};

/**
 * @description Discord's full-width Row Button, which runs something when pressed and asks first when `confirmation` is set;
 * `danger` leads with a red trash icon.
 * @param props The row's label, variant, confirmation and press handler.
 * @returns The row.
 */
function ButtonRow({
	label,
	subLabel,
	variant = 'button',
	confirmation,
	disabled = false,
	onPress,
}: ButtonRowProps): ReactElement {
	async function press() {
		if (
			confirmation &&
			!(await confirmText(showDialog, {
				title: confirmation,
				confirm: label,
				cancel: messages.UNBOUND_CANCEL,
				destructive: variant === 'danger',
			}))
		) {
			return;
		}

		onPress();
	}

	return (
		<Discord.RowButton
			label={label}
			subLabel={subLabel}
			variant='secondary'
			icon={
				variant === 'danger' ? (
					<Discord.TableRowIcon source={icons.TrashIcon} variant='danger' />
				) : undefined
			}
			arrow={false}
			disabled={disabled}
			onPress={() => void press()}
		/>
	);
}

export default ButtonRow;
