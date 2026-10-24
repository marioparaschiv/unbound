import { StyleSheet } from 'react-native';

export default StyleSheet.create({
	row: {
		alignItems: 'center',
		backgroundColor: '#2b2d31',
		borderRadius: 12,
		flexDirection: 'row',
		minHeight: 58,
		paddingHorizontal: 12,
	},
	pressed: { backgroundColor: '#35373c' },
	disabled: { opacity: 0.5 },
	icon: { borderRadius: 18, height: 36, marginRight: 12, width: 36 },
	acronym: { alignItems: 'center', backgroundColor: '#5865f2', justifyContent: 'center' },
	acronymText: { color: '#fff', fontSize: 15, fontWeight: '700' },
	name: { color: '#f2f3f5', flex: 1, fontSize: 15, fontWeight: '600' },
	chevron: { color: '#949ba4', fontSize: 18 },
});
