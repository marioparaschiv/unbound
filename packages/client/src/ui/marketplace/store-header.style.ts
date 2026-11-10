import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	header: {
		gap: 14,
	},
	identity: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
	},
	titles: {
		flex: 1,
		minWidth: 0,
		gap: 4,
	},
	name: {
		color: Theme.colors.TEXT_STRONG,
	},
	// The install count wraps under the version and date when the line runs out of room.
	metaRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
		columnGap: 8,
	},
	meta: {
		color: Theme.colors.TEXT_MUTED,
	},
	description: {
		lineHeight: 22,
		color: Theme.colors.TEXT_DEFAULT,
	},
});
