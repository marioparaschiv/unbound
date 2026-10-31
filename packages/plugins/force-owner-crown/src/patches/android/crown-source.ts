import { androidResourceUri } from '@unbound-plugins/shared/assets/android-resource';
import type { UnboundAsset } from '@unbound-app/api/assets';

/**
 * @description Points at the crown drawable Discord's APK ships, which Android's image views load directly.
 * @param asset The crown's asset.
 * @returns The drawable's URI, or `undefined` when the asset has no packager location.
 */
export function platformCrownSource(asset: UnboundAsset | undefined): string | undefined {
	if (!asset?.httpServerLocation) return;

	return androidResourceUri(asset);
}
