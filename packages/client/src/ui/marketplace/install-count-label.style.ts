import { Platform } from 'react-native';

import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

// Android's text renders glyphs about two points higher in their line than iOS, so only there does the
// icon rise to centre on the digits; on iOS the line's centre already is the digits' centre.
const nudge = Platform.OS === 'android' ? [{ translateY: -2 }] : [];

export default Discord.createStyles({
	label: {
		flexDirection: 'row',
		alignItems: 'center',
		flexShrink: 0,
		gap: 3,
	},
	// Sized to the line height of the text beside it.
	cardIcon: {
		width: 14,
		height: 14,
		tintColor: Theme.colors.TEXT_MUTED,
		transform: nudge,
	},
	pageIcon: {
		width: 16,
		height: 16,
		tintColor: Theme.colors.TEXT_MUTED,
		transform: nudge,
	},
});
