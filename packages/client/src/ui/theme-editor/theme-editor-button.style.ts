import { StyleSheet } from 'react-native';

import { Discord } from '~/api/metro/components';

/** Lifts the button above the bottom safe area so it clears the chat input, the user bar and the tab bar. */
export const BOTTOM_OFFSET = 128;

export default Discord.createStyles({
	// Full-size, so the self-positioned button stays inside its parent's bounds and receives touches.
	container: StyleSheet.absoluteFill,
	// Flows inside the safe-area padding, so the button's offset starts at the inset.
	safeArea: {
		flex: 1,
	},
});
