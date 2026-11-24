import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => ({
	body: { gap: 16, paddingHorizontal: 16, paddingBottom: 16 },
	image: { width: '100%', height: 160, borderRadius: metro.common.Theme.radii?.sm },
	progress: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
}));
