import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => ({
	body: { gap: 16, paddingHorizontal: 16, paddingBottom: 16 },
	preview: { width: '100%', height: 240, borderRadius: metro.common.Theme.radii?.sm },
}));
