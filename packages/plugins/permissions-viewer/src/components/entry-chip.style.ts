import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

// Mirrors Discord's filter `Tag` (design/components/TagGroup): round, 30pt tall, secondary control colours.
export default Discord.createStyles(() => {
	const { colors, radii } = metro.common.Theme;

	return {
		chip: {
			justifyContent: 'center',
			minHeight: 30,
			paddingHorizontal: 12,
			borderWidth: 1,
			borderRadius: radii?.round ?? 999,
			borderColor: colors?.CONTROL_SECONDARY_BORDER_DEFAULT,
			backgroundColor: colors?.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
		},
		selected: {
			borderColor: colors?.CONTROL_PRIMARY_BACKGROUND_DEFAULT,
			backgroundColor: colors?.CONTROL_SECONDARY_BACKGROUND_ACTIVE,
		},
	};
});
