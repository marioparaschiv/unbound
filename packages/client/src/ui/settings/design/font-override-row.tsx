import { memo } from 'react';

import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';
import { format } from '~/i18n/api';

import useFonts from './use-fonts';

type FontOverrideRowProps = {
	group: string;
};

/**
 * @description One Discord font group, such as PRIMARY, with the installed families its weights use,
 * or Default. Pressing it opens the group's page, which sets every family of the group at once.
 */
function FontOverrideRow({ group }: FontOverrideRowProps) {
	const fonts = useFonts();
	const navigation = Discord.useNavigation();
	const current = fonts.getGroupFamilies(group).join(', ') || format('UNBOUND_DEFAULT');

	return (
		<Discord.TableRow
			label={group}
			trailing={<Discord.TableRow.TrailingText text={current} />}
			arrow
			onPress={() => navigation.push(Screens.FontGroup, { group })}
		/>
	);
}

export default memo(FontOverrideRow);
