import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Every child centres on one axis, so the badge, text and button line up whatever their widths.
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 16,
		paddingHorizontal: 24,
	},
	text: {
		alignItems: 'center',
		gap: 4,
	},
	centered: {
		textAlign: 'center',
	},
});
