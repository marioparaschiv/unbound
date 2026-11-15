import { native } from '@unbound-app/api';

import { greentextAndroid as android } from '~/native/android/greentext';
import { greentextIOS as ios } from '~/native/ios/greentext';

export type GreentextSession = { update(hex: string): void; dispose(): void };

/**
 * @description Colors the lines of message text that start with `>`.
 */
export const greentext = native.definePlatform({ ios, android });
