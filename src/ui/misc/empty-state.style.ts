import { Constants, Theme } from '@api/metro/common';
import { Discord } from '@api/metro/components';


export default Discord.createStyles({
	recoveryContainer: {
		marginTop: 10
	},

	empty: {
		justifyContent: 'center',
		alignItems: 'center',
		marginVertical: 40
	},

	emptyImage: {
		marginBottom: 10
	},

	emptyMessage: {
		color: Theme.colors.TEXT_MUTED,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		textAlign: 'center',
		paddingHorizontal: 25
	}
});