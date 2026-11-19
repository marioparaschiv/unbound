import { native } from '@unbound-app/api';

import { japaneseTokensIOS as ios } from '~/native/ios/tokens';

/** Splits Japanese text into words with their readings; iOS only, as Android ships no Japanese reader. */
export const japaneseTokens = native.definePlatform({ ios });
