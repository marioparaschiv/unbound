import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';

export default Discord.createStyles({
	sectionWrapper: {
		marginHorizontal: 16,
		marginTop: 16,
	},
	iconTint: {
		tintColor: Theme.colors.INTERACTIVE_ICON_DEFAULT,
	},
	endStyle: {
		marginBottom: 32,
	},
});
