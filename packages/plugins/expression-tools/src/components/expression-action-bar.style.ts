import { Discord } from '@unbound-app/api/metro/components';

export default Discord.createStyles(() => ({
	bar: { flexDirection: 'row', columnGap: 8, marginHorizontal: 12, marginTop: 10 },
	button: { flex: 1 },
}));
