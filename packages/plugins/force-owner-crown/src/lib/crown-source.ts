import { definePlatform } from '@unbound-app/api/native';

import { platformCrownSource as android } from '~/lib/android/crown-source';
import { platformCrownSource as ios } from '~/lib/ios/crown-source';

export const platformCrownSource = definePlatform({ ios, android });
