import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => {
	const { colors } = metro.common.Theme;

	return {
		state: { width: 20, height: 20 },
		allowed: { tintColor: colors?.TEXT_FEEDBACK_POSITIVE },
		denied: { tintColor: colors?.TEXT_FEEDBACK_CRITICAL },
		small: { width: 16, height: 16 },
		owner: { tintColor: colors?.TEXT_FEEDBACK_WARNING },
		muted: { tintColor: colors?.INTERACTIVE_ICON_DEFAULT },
	};
});
