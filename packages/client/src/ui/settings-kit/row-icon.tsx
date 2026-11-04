import type { IconInput } from '@unbound-app/types/components';
import type { ReactElement } from 'react';
import { isValidElement } from 'react';

import { Discord } from '~/metro/components';

type RowIconProps = {
	icon: IconInput;
};

/**
 * @description Draws a row's icon the way Discord's rows do: an element as given, an asset id or an icon
 * component through `TableRowIcon`, which sizes and tints it for the row.
 * @param props The icon.
 * @returns The icon element.
 */
function RowIcon({ icon }: RowIconProps): ReactElement {
	if (isValidElement(icon)) {
		return icon;
	}

	return typeof icon === 'number' ? (
		<Discord.TableRowIcon source={icon} />
	) : (
		<Discord.TableRowIcon IconComponent={icon} />
	);
}

export default RowIcon;
