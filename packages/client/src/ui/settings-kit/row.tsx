import type { DesignModule, IconInput } from '@unbound-app/types/components';
import type { ComponentProps, ReactElement } from 'react';
import type { Without } from '@unbound-app/types/utils';

import { Discord } from '~/metro/components';

import RowIcon from './row-icon';

/** Props of {@link Row}: Discord's `TableRow` props, such as `label`, `subLabel` and `onPress`, and an {@link IconInput} `icon`. */
export type RowProps = Without<ComponentProps<DesignModule['TableRow']>, 'icon'> & {
	/** An asset id, an element such as `<Star />`, or an icon component such as `Star`. */
	icon?: IconInput;
};

/**
 * @description One settings row, Discord's `TableRow`.
 * @param props The row's label, sub-label, icon, trailing content and press handler.
 * @returns The row.
 */
function Row({ icon, ...props }: RowProps): ReactElement {
	return (
		<Discord.TableRow
			{...props}
			icon={icon === undefined ? undefined : <RowIcon icon={icon} />}
		/>
	);
}

export default Row;
