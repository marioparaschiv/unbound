import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => {
	const { colors } = metro.common.Theme;

	return {
		row: { flexDirection: 'row', columnGap: 12, paddingVertical: 8 },
		avatar: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: colors.BACKGROUND_MOD_SUBTLE,
		},
		body: { flex: 1, rowGap: 2 },
		header: { flexDirection: 'row', alignItems: 'center', columnGap: 6, flexWrap: 'wrap' },
		name: { flexShrink: 1 },
		footer: { flexDirection: 'row', alignItems: 'center', columnGap: 16, marginTop: 6 },
		vote: { flexDirection: 'row', alignItems: 'center', columnGap: 4 },
		idle: { color: colors.INTERACTIVE_ICON_DEFAULT },
		upvoted: { color: colors.TEXT_FEEDBACK_POSITIVE },
		downvoted: { color: colors.TEXT_FEEDBACK_CRITICAL },
	};
});
