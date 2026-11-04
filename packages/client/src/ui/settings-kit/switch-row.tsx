import type { DesignModule, IconInput } from '@unbound-app/types/components';
import type { ComponentProps, ReactElement } from 'react';
import type { Without } from '@unbound-app/types/utils';

import { Discord } from '~/metro/components';

import RowIcon from './row-icon';

/** Props of {@link SwitchRow}: Discord's `TableSwitchRow` props, such as `label`, `value` and `onValueChange`, and an {@link IconInput} `icon`. */
export type SwitchRowProps = Without<ComponentProps<DesignModule['TableSwitchRow']>, 'icon'> & {
	/** An asset id, an element such as `<Star />`, or an icon component such as `Star`. */
	icon?: IconInput;
};

/**
 * @description A settings row with a switch, Discord's `TableSwitchRow`.
 * @param props The row's label, value, change handler and icon.
 * @returns The row.
 */
function SwitchRow({ icon, ...props }: SwitchRowProps): ReactElement {
	return (
		<Discord.TableSwitchRow
			{...props}
			icon={icon === undefined ? undefined : <RowIcon icon={icon} />}
		/>
	);
}

export default SwitchRow;
