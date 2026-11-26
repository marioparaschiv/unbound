import { Discord } from '@unbound-app/api/metro/components';

const STICKER_SIZE = 76;

export default Discord.createStyles({
	body: { gap: 24, paddingHorizontal: 16, paddingBottom: 16 },
	pack: { gap: 8 },
	packHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	packTitle: { flex: 1 },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	sticker: { width: STICKER_SIZE, height: STICKER_SIZE },
	empty: { textAlign: 'center', paddingVertical: 12 },
});
