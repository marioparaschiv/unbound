export interface DiscordAsset {
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

	[key: PropertyKey]: any;
}

export interface AssetsModule {
	registerAsset: (asset: DiscordAsset) => number;
	getAssetByID: (id: number) => DiscordAsset | null;

	[key: PropertyKey]: any;
}
