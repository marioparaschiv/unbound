import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps, ReactElement } from 'react';

import { Discord } from '~/metro/components';

/** Props of {@link SwitchRow}: Discord's `TableSwitchRow` props, such as `label`, `value` and `onValueChange`. */
export type SwitchRowProps = ComponentProps<DesignModule['TableSwitchRow']>;

/**
 * @description A settings row with a switch, Discord's `TableSwitchRow`.
 * @param props The row's label, value and change handler.
 * @returns The row.
 */
function SwitchRow(props: SwitchRowProps): ReactElement {
	return <Discord.TableSwitchRow {...props} />;
}

export default SwitchRow;
