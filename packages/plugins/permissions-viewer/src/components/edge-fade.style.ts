import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => {
	const { colors } = metro.common.Theme;

	return {
		fade: { position: 'absolute', top: 0, bottom: 0, width: 28 },
		// Read as a resolved string for the gradient's stops: the action sheet's background.
		sheet: { color: colors?.MOBILE_ACTIONSHEET_BACKGROUND },
		start: { left: 0 },
		end: { right: 0 },
	};
});
