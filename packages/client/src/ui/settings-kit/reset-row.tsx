import type { ReactElement } from 'react';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

export type ResetRowProps = {
	label?: string;
	onReset: () => void;
};

/**
 * @description A settings group with one row that puts every setting on the page back to its default.
 * @param props The row's label, "Reset all to defaults" unless given, and what resetting does.
 * @returns The group.
 */
function ResetRow({ label = messages.UNBOUND_RESET_ALL, onReset }: ResetRowProps): ReactElement {
	return (
		<Discord.TableRowGroup>
			<Discord.TableRow label={label} variant='danger' onPress={onReset} />
		</Discord.TableRowGroup>
	);
}

export default ResetRow;
