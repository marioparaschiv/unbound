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
	/** Dims the row and ignores input. Defaults to false. */
	disabled?: boolean;
	/** Called when the row is pressed, after the user confirms. */
	onPress: () => void;
};

/**
 * @description A pressable `TableRow` in its settings group, as Discord draws actions such as Log Out; it asks first when
 * `confirmation` is set. `danger` draws the label red behind a red trash icon.
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
		<Discord.TableRow
			label={label}
			subLabel={subLabel}
			variant={variant === 'danger' ? 'danger' : undefined}
			icon={
				variant === 'danger' ? (
					<Discord.TableRowIcon source={icons.TrashIcon} variant='danger' />
				) : undefined
			}
			disabled={disabled}
			onPress={() => void press()}
		/>
	);
}

export default ButtonRow;
