import { definePlatform } from '@unbound-app/api/native';

import { platformCrownSource as android } from '~/crown/android/crown-source';
import { platformCrownSource as ios } from '~/crown/ios/crown-source';

export const platformCrownSource = definePlatform({ ios, android });
