import { Discord } from '@api/metro/components';
import { Theme } from '@api/metro/common';


const useStyles = Discord.createStyles({
	trailingText: {
		color: Theme.colors.TEXT_MUTED
	},
	container: {
		marginBottom: 25
	},

	contentContainer: {
		backfaceVisibility: 'hidden'
	}
});

export default useStyles;