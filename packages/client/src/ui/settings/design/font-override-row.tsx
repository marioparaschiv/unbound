import { nearestSlot } from '~/fonts/slots';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { Screens } from '~/core/constants';
import { format } from '~/i18n/api';

import { groupHint, groupLabel } from './font-labels';
import FontSampleIcon from './font-sample-icon';

type FontOverrideRowProps = {
	group: string;
};

/**
 * @description One Discord font group, named by what it draws, led by "Aa" in its regular weight's font and
 * trailed by the installed families its weights use, or Default. Pressing it opens the group's page. The
 * Fonts tab re-renders it on store changes, so it holds no listener of its own.
 */
function FontOverrideRow({ group }: FontOverrideRowProps) {
	const fonts = Manager.for('font');
	const navigation = Discord.useNavigation();
	const regular = nearestSlot(fonts.getSlots(group), 400);
	const current = fonts.getGroupFamilies(group).join(', ') || format('UNBOUND_DEFAULT');

	return (
		<Discord.TableRow
			label={groupLabel(group)}
			subLabel={groupHint(group)}
			icon={<FontSampleIcon family={regular?.families[0]} />}
			trailing={<Discord.TableRow.TrailingText text={current} />}
			arrow
			onPress={() => navigation.push(Screens.FontGroup, { group })}
		/>
	);
}

export default FontOverrideRow;
