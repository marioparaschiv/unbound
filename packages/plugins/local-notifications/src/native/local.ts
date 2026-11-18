import { native } from '@unbound-app/api';

import { startKeepAlive } from '~/native/ios/keepalive';
import {
	askPermission,
	deliveredIds,
	listenForActions,
	postNotification,
	registerActions,
} from '~/native/ios/notify';

export const keepAlive = native.definePlatform({ ios: startKeepAlive });
export const permission = native.definePlatform({ ios: askPermission });
export const post = native.definePlatform({ ios: postNotification });
export const delivered = native.definePlatform({ ios: deliveredIds });
export const actions = native.definePlatform({ ios: registerActions });
export const onActions = native.definePlatform({ ios: listenForActions });
export { ACTIONS } from '~/native/ios/notify';
export { notificationId } from '~/native/ios/notify';
export type { NotificationAction, NotificationTarget } from '~/native/ios/notify';
