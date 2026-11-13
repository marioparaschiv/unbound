import { Discord } from '@unbound-app/api/metro/components';

export default Discord.createStyles(() => ({
	list: { paddingHorizontal: 16, paddingBottom: 32, rowGap: 8 },
	empty: { alignItems: 'center', rowGap: 4, paddingVertical: 24 },
	composer: { rowGap: 12, paddingTop: 8 },
}));
