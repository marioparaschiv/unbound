import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	badge: {
		width: 60,
		height: 60,
	},
	// Layers stack in the badge so the leaving one pops out over the arriving one.
	layer: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 30,
	},
	icon: {
		width: 30,
		height: 30,
	},
	positiveBadge: {
		backgroundColor: Theme.colors.BACKGROUND_FEEDBACK_POSITIVE,
	},
	positiveIcon: {
		tintColor: Theme.colors.ICON_FEEDBACK_POSITIVE,
	},
	warningBadge: {
		backgroundColor: Theme.colors.BACKGROUND_FEEDBACK_WARNING,
	},
	warningIcon: {
		tintColor: Theme.colors.ICON_FEEDBACK_WARNING,
	},
	brandBadge: {
		backgroundColor: Theme.colors.BACKGROUND_BRAND,
	},
	brandIcon: {
		tintColor: Theme.colors.WHITE,
	},
	criticalBadge: {
		backgroundColor: Theme.colors.BACKGROUND_FEEDBACK_CRITICAL,
	},
	criticalIcon: {
		tintColor: Theme.colors.ICON_FEEDBACK_CRITICAL,
	},
	neutralBadge: {
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	neutralIcon: {
		tintColor: Theme.colors.INTERACTIVE_ICON_DEFAULT,
	},
});
