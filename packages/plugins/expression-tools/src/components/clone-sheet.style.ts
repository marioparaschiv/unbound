import { StyleSheet } from 'react-native';

export default StyleSheet.create({
	container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
	header: { alignItems: 'center', flexDirection: 'row', marginBottom: 16 },
	preview: { borderRadius: 12, height: 48, marginRight: 12, width: 48 },
	headerText: { flex: 1 },
	title: { color: '#f2f3f5', fontSize: 18, fontWeight: '700' },
	subtitle: { color: '#b5bac1', fontSize: 13, marginTop: 2 },
	label: { color: '#b5bac1', fontSize: 12, fontWeight: '600', marginBottom: 7 },
	spacedLabel: { marginTop: 16 },
	guilds: { gap: 8, marginTop: 12 },
	empty: { color: '#b5bac1', paddingVertical: 16, textAlign: 'center' },
});
