import { StyleSheet } from 'react-native';

import { Constants, Theme } from '~/metro/common';
import { Discord } from '~/metro/components';

export default Discord.createStyles({
	body: {
		gap: 12,
	},
	text: {
		lineHeight: 22,
		color: Theme.colors.TEXT_DEFAULT,
	},
	heading: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 10,
	},
	headingText: {
		flex: 1,
		color: Theme.colors.TEXT_STRONG,
	},
	strong: {
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		color: Theme.colors.TEXT_STRONG,
	},
	em: {
		fontStyle: 'italic',
	},
	underline: {
		textDecorationLine: 'underline',
	},
	del: {
		textDecorationLine: 'line-through',
		color: Theme.colors.TEXT_MUTED,
	},
	inlineCode: {
		fontFamily: Constants.Fonts.CODE_NORMAL,
		fontSize: 14,
		color: Theme.colors.TEXT_STRONG,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	link: {
		fontFamily: Constants.Fonts.PRIMARY_MEDIUM,
		color: Theme.colors.TEXT_LINK,
	},
	list: {
		gap: 8,
	},
	item: {
		flexDirection: 'row',
		gap: 10,
	},
	// One line box tall, so a bullet, number or icon centres on the item's first line.
	marker: {
		minWidth: 16,
		height: 22,
		alignItems: 'center',
		justifyContent: 'center',
	},
	bullet: {
		color: Theme.colors.TEXT_MUTED,
	},
	itemBody: {
		flex: 1,
		minWidth: 0,
		gap: 8,
	},
	media: {
		maxWidth: '100%',
	},
	codeBlock: {
		padding: 12,
		borderRadius: Theme.radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: Theme.colors.BORDER_SUBTLE,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	code: {
		fontFamily: Constants.Fonts.CODE_NORMAL,
		fontSize: 13,
		lineHeight: 19,
		color: Theme.colors.TEXT_DEFAULT,
	},
	quote: {
		gap: 8,
		paddingLeft: 12,
		borderLeftWidth: 3,
		borderLeftColor: Theme.colors.BORDER_STRONG,
	},
	rule: {
		height: StyleSheet.hairlineWidth,
		marginVertical: 4,
		backgroundColor: Theme.colors.BORDER_SUBTLE,
	},
	table: {
		borderRadius: Theme.radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: Theme.colors.BORDER_SUBTLE,
		overflow: 'hidden',
	},
	row: {
		flexDirection: 'row',
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: Theme.colors.BORDER_SUBTLE,
	},
	headerRow: {
		borderTopWidth: 0,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	cell: {
		width: 160,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
});
