import { Discord } from '~/metro/components';

/** Lifts the editor's button above the bottom inset, clear of the chat input, the user bar and the tab bar. */
export const BUTTON_OFFSET = 96;
/** Stacks the picker's button above it: a floating button is 56 tall, plus a 12 gap. */
export const PICK_BUTTON_OFFSET = BUTTON_OFFSET + 68;

export default Discord.createStyles({
	// Fills the inset area, so the self-positioned buttons measure from the inset.
	anchor: {
		flex: 1,
	},
});
