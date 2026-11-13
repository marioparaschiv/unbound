import { Discord } from '@unbound-app/api/metro/components';

export default Discord.createStyles(() => ({
	container: { paddingHorizontal: 16, paddingBottom: 16, rowGap: 16 },
	preview: { width: 48, height: 48, borderRadius: 12, alignSelf: 'center' },
	empty: { paddingVertical: 16, alignItems: 'center' },
}));
