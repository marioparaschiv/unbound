import type { BundleInfoType } from '~/native/native';
import { BundleInfo } from '~/native/native';

type NativeBundleInfo = Partial<BundleInfoType> & {
	getConstants?: () => Partial<BundleInfoType>;
};

/**
 * @description Reads Discord's bundle constants, through `getConstants()` when the module is a TurboModule.
 * @returns The version, build and other constants, or an empty object when the module is missing.
 */
export function readBundleInfo(): Partial<BundleInfoType> {
	const info: NativeBundleInfo = BundleInfo ?? {};

	return info.getConstants?.() ?? info;
}

export default readBundleInfo;
