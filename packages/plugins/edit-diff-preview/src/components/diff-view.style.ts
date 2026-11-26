import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => ({
	scroll: { maxHeight: 320 },
	code: { fontFamily: metro.common.Constants.Fonts?.CODE_NORMAL },
}));
