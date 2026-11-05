import { StyleSheet } from 'react-native';

export default StyleSheet.create({
	bar: { flexDirection: 'row', gap: 6, marginHorizontal: 12, marginTop: 10 },
	button: {
		alignItems: 'center',
		backgroundColor: '#5865f2',
		borderRadius: 9,
		flex: 1,
		justifyContent: 'center',
		minHeight: 38,
		paddingHorizontal: 6,
	},
	pressed: { backgroundColor: '#4752c4' },
	disabled: { opacity: 0.55 },
	label: { color: '#f2f3f5', fontSize: 12, fontWeight: '700' },
});
