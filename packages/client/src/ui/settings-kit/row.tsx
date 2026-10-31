import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps, ReactElement } from 'react';

import { Discord } from '~/metro/components';

/** Props of {@link Row}: Discord's `TableRow` props, such as `label`, `subLabel` and `onPress`. */
export type RowProps = ComponentProps<DesignModule['TableRow']>;

/**
 * @description One settings row, Discord's `TableRow`.
 * @param props The row's label, sub-label, icon, trailing content and press handler.
 * @returns The row.
 */
function Row(props: RowProps): ReactElement {
	return <Discord.TableRow {...props} />;
}

export default Row;
