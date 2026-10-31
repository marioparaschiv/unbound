import { native } from '@unbound-app/api';

import { platformCrownSource as android } from '~/patches/android/crown-source';
import { platformCrownSource as ios } from '~/patches/ios/crown-source';

export const platformCrownSource = native.definePlatform({ ios, android });
