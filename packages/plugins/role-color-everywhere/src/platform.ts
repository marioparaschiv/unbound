import { native } from '@unbound-app/api';

import {
	enableMentions as enableAndroidMentions,
	ROLE_MENTION_COLORS as androidRoleMentionColors,
} from '~/android/mentions';
import {
	enableMentions as enableIosMentions,
	ROLE_MENTION_COLORS as iosRoleMentionColors,
} from '~/ios/mentions';

export const enableNativeMentions = native.definePlatform({
	ios: enableIosMentions,
	android: enableAndroidMentions,
});

export const roleMentionColors = native.definePlatform({
	ios: iosRoleMentionColors,
	android: androidRoleMentionColors,
});
