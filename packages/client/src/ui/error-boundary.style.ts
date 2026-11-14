import { Constants, Radius, Theme } from '~/metro/common';
import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Bound to the screen's height and never scrolls; only the trace inside the error card scrolls.
	screen: {
		flex: 1,
		padding: 16,
		backgroundColor: Theme.colors.BACKGROUND_BASE_LOW,
	},
	// Carries the screen's height down to the error card, so its trace takes the space left over.
	fill: {
		flex: 1,
	},
	card: {
		gap: 12,
		padding: 16,
	},
	header: {
		flex: 1,
		minWidth: 0,
		gap: 6,
	},
	logo: {
		alignSelf: 'center',
		shadowColor: '#000000',
		shadowOpacity: 0.35,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
	},
	// Handed to the SVG logo, which takes a colour string rather than a style.
	logoTint: {
		color: Theme.colors.MOBILE_TEXT_HEADING_PRIMARY,
	},
	errorName: {
		color: Theme.colors.TEXT_FEEDBACK_CRITICAL,
	},
	code: {
		flex: 1,
		borderRadius: Radius.Radius.md,
		backgroundColor: Theme.colors.BACKGROUND_BASE_LOWER,
	},
	codeContent: {
		padding: 12,
	},
	codeText: {
		fontSize: 12,
		lineHeight: 18,
		fontFamily: Constants.Fonts.CODE_NORMAL,
		color: Theme.colors.TEXT_MUTED,
	},
	tile: {
		flex: 1,
		minWidth: 0,
		alignItems: 'center',
		gap: 10,
		padding: 14,
	},
});
