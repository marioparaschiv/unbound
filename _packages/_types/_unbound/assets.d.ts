import type { DiscordAsset } from '../discord/assets';


export type UnboundAsset = DiscordAsset & {
	/**
	 * Full icon path used for overwriting icons with icon packs.
	 */
	iconPackPath?: string;

	/**
	 * Scale decided by finding the largest scale of an asset which is defined in an icon pack.
	 */
	iconPackScale?: number;
};
