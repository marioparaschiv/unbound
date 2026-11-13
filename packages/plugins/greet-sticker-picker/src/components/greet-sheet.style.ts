import { StyleSheet } from 'react-native';

export default StyleSheet.create({
	content: { gap: 16, paddingBottom: 32 },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
	cell: { alignItems: 'center', borderRadius: 12, gap: 4, padding: 8, width: 96 },
	pressed: { opacity: 0.5 },
});
