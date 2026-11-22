import { Discord } from '~/metro/components';

export default Discord.createStyles({
	page: {
		flex: 1,
	},
	// `Page`'s padding. FlashList also pads its rows' container vertically, a gap under the header, so those pad instead.
	content: {
		paddingHorizontal: 16,
	},
	header: {
		paddingTop: 16,
	},
	// The 24 point gap `Page` sets between groups, above the groups after the addon rows.
	footer: {
		paddingTop: 24,
		paddingBottom: 16,
	},
});
