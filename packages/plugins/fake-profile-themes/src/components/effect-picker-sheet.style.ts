import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

const { colors } = metro.common.Theme;

export default Discord.createStyles({
	list: {
		paddingHorizontal: 16,
		paddingBottom: 24,
	},
	search: {
		paddingTop: 8,
		paddingBottom: 16,
	},
	row: {
		flexDirection: 'row',
		gap: 12,
		marginBottom: 12,
	},
	tile: {
		flex: 1,
		gap: 6,
	},
	preview: {
		aspectRatio: 0.75,
		borderRadius: 8,
		borderWidth: 2,
		borderColor: 'transparent',
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors?.BACKGROUND_MOD_SUBTLE,
	},
	selected: {
		borderColor: colors?.ICON_BRAND,
	},
	pressed: {
		opacity: 0.6,
	},
	image: {
		width: '100%',
		height: '100%',
	},
	spacer: {
		flex: 1,
	},
});
