import { Discord } from '~/metro/components';

/** Lifts the button above the bottom inset, clear of the chat input, the user bar and the tab bar. */
export const BUTTON_OFFSET = 96;

export default Discord.createStyles({
	// Fills the inset area, so the self-positioned button measures from the inset.
	anchor: {
		flex: 1,
	},
});
