import { Discord } from '@unbound-app/api/metro/components';

export default Discord.createStyles({
	body: { gap: 12, paddingBottom: 32 },
	chips: { gap: 8 },
	section: { gap: 12 },
	buttons: { flexDirection: 'row', gap: 8 },
	button: { flex: 1 },
	empty: { alignItems: 'center', paddingVertical: 24 },
});
