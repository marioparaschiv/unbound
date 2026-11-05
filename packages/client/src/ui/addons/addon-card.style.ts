import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	card: {
		gap: 14,
		padding: 16,
	},
	heading: {
		flex: 1,
		minWidth: 0,
		gap: 2,
	},
	// Discord's Stack sets `width: '100%'`; inside a row it would squeeze its flexible siblings.
	actions: {
		width: 'auto',
		flexShrink: 0,
	},
	badges: {
		width: 'auto',
		flexShrink: 0,
	},
	bottom: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 12,
		marginTop: -8,
	},
	description: {
		flex: 1,
		minWidth: 0,
		alignSelf: 'flex-start',
		lineHeight: 19,
		color: Theme.colors.TEXT_DEFAULT,
	},
	spacer: {
		flex: 1,
	},
	failed: {
		opacity: 0.5,
	},
	error: {
		marginTop: 4,
		color: Theme.colors.TEXT_FEEDBACK_CRITICAL,
	},
});
