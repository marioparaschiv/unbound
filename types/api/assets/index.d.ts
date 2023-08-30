export interface Asset {
	__packager_asset?: boolean;

	/**
	 * Name of the asset.
	 */
	name: string;

	/**
	 * Location of the asset in the local assets directory.
	 */
	httpServerLocation?: string;

    /**
     * Full icon path used for overwriting icons with icon packs.
     */
    iconPackPath?: string;

    /**
     * Scale decided by finding the largest scale of an asset which is defined in an icon pack.
     */
    iconPackScale?: number;

	/**
	 * Width of the asset.
	 */
	width: number;

	/**
	 * Height of the asset.
	 */
	height: number;

	/**
	 * Scales that the asset is available in. For example: [1, 2] means that the asset is available in 1x and 2x sizes.
	 */
	scales: number[];

	/**
	 * Hash of the asset.
	 */
	hash: string;

	/**
	 * File extension of the asset.
	 */
	type: string;

	/**
	 * ID of the asset.
	 */
	id: number;
}
