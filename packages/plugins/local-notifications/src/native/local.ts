import { native } from '@unbound-app/api';

import { startKeepAlive } from '~/native/ios/keepalive';
import { askPermission, deliveredIds, postNotification } from '~/native/ios/notify';

export const keepAlive = native.definePlatform({ ios: startKeepAlive });
export const permission = native.definePlatform({ ios: askPermission });
export const post = native.definePlatform({ ios: postNotification });
export const delivered = native.definePlatform({ ios: deliveredIds });
export { notificationId } from '~/native/ios/notify';
export type { NotificationTarget } from '~/native/ios/notify';
