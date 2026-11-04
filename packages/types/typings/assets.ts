import type { DiscordAssetName, DiscordAssetType } from '@unbound-app/discord-types/assets';

import type { LiteralUnion } from './utils';

export type {
	DiscordAssetName,
	DiscordAssetNames,
	DiscordAssetType,
} from '@unbound-app/discord-types/assets';

/** A file type the asset lookups take: Discord's types as suggestions, and any other string. */
export type AssetType = LiteralUnion<DiscordAssetType>;

/**
 * An asset name of file type `T`: the names Discord's generated build registers as suggestions, and any other
 * string, since a build may register names the generator never saw.
 */
export type AssetName<T extends string = DiscordAssetType> = LiteralUnion<
	DiscordAssetName<Extract<T, DiscordAssetType>>
>;

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

/** A {@link DiscordAsset} extended with Unbound's icon-pack overrides and the files of an asset a plugin registered. */
export type UnboundAsset = DiscordAsset & {
	iconPackPath?: string;
	iconPackScale?: number;
	/** The URI of a registered plugin asset at each scale; set while it is registered. */
	unboundSources?: Record<number, string>;
};

/** The native module used to register and resolve {@link DiscordAsset}s by id. */
export type AssetsModule = {
	/** Adds an asset to the registry and returns its new asset id. */
	registerAsset: (asset: DiscordAsset) => number;
	/** Returns the asset registered under `id`; `null` or `undefined` when there is none. */
	getAssetByID: (id: number) => DiscordAsset | null;
};
