import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	content: {
		gap: 12,
		marginTop: 4,
	},
	found: {
		gap: 8,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
	},
	chip: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_SUBTLE,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	selected: {
		borderColor: Theme.colors.BACKGROUND_BRAND,
		backgroundColor: Theme.colors.BACKGROUND_BRAND,
	},
	label: {
		color: Theme.colors.TEXT_DEFAULT,
	},
	selectedLabel: {
		color: Theme.colors.WHITE,
	},
});
