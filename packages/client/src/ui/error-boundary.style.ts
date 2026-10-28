import { Theme } from '~/api/metro/common';

const colors = Theme?.colors ?? {};

/** Plain React Native styles with fixed fallbacks, so the screen still reads if Discord's theme failed too. */
export default {
	screen: {
		flex: 1,
		backgroundColor: colors.BACKGROUND_PRIMARY ?? '#1e1f22',
	},
	content: {
		padding: 24,
		paddingTop: 72,
		gap: 16,
	},
	title: {
		fontSize: 22,
		fontWeight: '700',
		color: colors.TEXT_NORMAL ?? '#f2f3f5',
	},
	subtitle: {
		fontSize: 15,
		lineHeight: 21,
		color: colors.TEXT_MUTED ?? '#b5bac1',
	},
	errorCard: {
		borderRadius: 12,
		padding: 14,
		gap: 6,
		backgroundColor: colors.BACKGROUND_SECONDARY ?? '#2b2d31',
	},
	errorName: {
		fontSize: 13,
		fontWeight: '700',
		color: colors.TEXT_DANGER ?? '#f23f43',
	},
	errorMessage: {
		fontSize: 15,
		color: colors.TEXT_NORMAL ?? '#f2f3f5',
	},
	sectionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 10,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: '600',
		color: colors.TEXT_NORMAL ?? '#f2f3f5',
	},
	sectionToggle: {
		fontSize: 13,
		color: colors.TEXT_MUTED ?? '#b5bac1',
	},
	trace: {
		fontSize: 11,
		fontFamily: 'Menlo',
		color: colors.TEXT_MUTED ?? '#b5bac1',
	},
	actions: {
		gap: 10,
		paddingTop: 8,
	},
	button: {
		borderRadius: 999,
		paddingVertical: 13,
		alignItems: 'center',
		backgroundColor: colors.BACKGROUND_MOD_SUBTLE ?? '#3f4147',
	},
	primaryButton: {
		backgroundColor: colors.BUTTON_FILLED_BRAND_BACKGROUND ?? '#5865f2',
	},
	buttonText: {
		fontSize: 15,
		fontWeight: '600',
		color: colors.TEXT_NORMAL ?? '#f2f3f5',
	},
	primaryButtonText: {
		color: '#ffffff',
	},
} as const;
