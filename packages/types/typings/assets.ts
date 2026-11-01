/** An asset registered with Discord's packager (its metadata and dimensions). */
export type DiscordAsset = {
	/** `true` on assets the React Native packager generated. */
	__packager_asset?: boolean;
	/** The file name without extension, such as `ic_close`; `assets.getByName` matches on it. */
	name: string;
	/** The asset's directory in the bundle, such as `/assets/images`. */
	httpServerLocation: string;
	/** Width in points at scale 1. */
	width: number;
	/** Height in points at scale 1. */
	height: number;
	/** The pixel densities the bundle ships the file at, such as `[1, 2, 3]`. */
	scales: number[];
	/** The packager's content hash of the file. */
	hash: string;
	/** The file extension, such as `png` or `svg`. */
	type: string;
};

/** A {@link DiscordAsset} extended with Unbound's icon-pack overrides. */
export type UnboundAsset = DiscordAsset & {
	iconPackPath?: string;
	iconPackScale?: number;
};

/** The native module used to register and resolve {@link DiscordAsset}s by id. */
export type AssetsModule = {
	/** Adds an asset to the registry and returns its new asset id. */
	registerAsset: (asset: DiscordAsset) => number;
	/** Returns the asset registered under `id`; `null` or `undefined` when there is none. */
	getAssetByID: (id: number) => DiscordAsset | null;
};
