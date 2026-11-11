import { definePlatform } from '@unbound-app/api/native';

import { platformCrownSource as android } from '~/lib/crown-source-android';
import { platformCrownSource as ios } from '~/lib/crown-source-ios';

export const platformCrownSource = definePlatform({ ios, android });
