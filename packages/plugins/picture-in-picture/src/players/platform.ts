import { native } from '@unbound-app/api';

import { sessionProps as android } from '~/players/android/overrides';
import { sessionProps as ios } from '~/players/ios/overrides';

export const sessionProps = native.definePlatform({ ios, android });
