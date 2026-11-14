import { Discord } from '@unbound-app/api/metro/components';

export default Discord.createStyles({
	body: {
		gap: 16,
		paddingTop: 8,
		paddingBottom: 24,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	cover: {
		width: 64,
		height: 64,
		borderRadius: 8,
	},
	titles: {
		flex: 1,
		gap: 2,
	},
	status: {
		textAlign: 'center',
		paddingVertical: 12,
	},
});
