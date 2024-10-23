import { Constants, Theme } from '@api/metro/common';
import { Discord } from '@api/metro/components';


export default Discord.createStyles({
	block: {
		fontFamily: Constants.Fonts.CODE_SEMIBOLD,
		fontSize: 12,

		backgroundColor: Theme.colors.BACKGROUND_SECONDARY_ALT,
		color: Theme.colors.TEXT_NORMAL,

		padding: 10
	}
});