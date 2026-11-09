import { StyleSheet } from 'react-native';

import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	list: {
		alignSelf: 'stretch',
		borderRadius: 12,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
		paddingHorizontal: 12,
	},
	item: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 10,
	},
	separated: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: Theme.colors.BORDER_SUBTLE,
	},
	pressed: {
		opacity: 0.6,
	},
	name: {
		flex: 1,
	},
	version: {
		color: Theme.colors.TEXT_BRAND,
	},
});
