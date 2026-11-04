// Type-level tests, checked by `bun run typecheck` and never run: asset lookups suggest Discord's names and accept any.
import type * as Assets from '../src/assets';

type Expect<T extends true> = T;
type Equal<A, B> =
	(<V>() => V extends A ? 1 : 2) extends <V>() => V extends B ? 1 : 2 ? true : false;
type PngName = Parameters<typeof Assets.getIdByName<'png'>>[0];
type LottieName = Parameters<typeof Assets.getIdByName<'lottie'>>[0];

// The parameters keep Discord's literals beside `string & {}`, so editors still suggest them.
export type PngSuggestsNames = Expect<
	Equal<PngName, Assets.DiscordAssetName<'png'> | (string & {})>
>;
export type PngHasWrench = Expect<
	'WrenchIcon' extends Assets.DiscordAssetName<'png'> ? true : false
>;
export type AnyNameAccepted = Expect<string extends PngName ? true : false>;
// The names narrow by file type, so a lottie lookup suggests lottie names only.
export type LottieSuggestsNames = Expect<
	Equal<LottieName, Assets.DiscordAssetName<'lottie'> | (string & {})>
>;
export type LottieHasGems = Expect<
	'NitroGem1' extends Assets.DiscordAssetName<'lottie'> ? true : false
>;
export type NamesNarrowByType = Expect<
	'NitroGem1' extends Assets.DiscordAssetName<'png'> ? false : true
>;

declare const assets: typeof Assets;

const known = assets.getIdByName('WrenchIcon');
const lottie = assets.getIdByName('NitroGem1', 'lottie');
const unknown = assets.getIdByName('IconAddedNextBuild');
const unknownType = assets.getIdByName('icons/star', 'webp');
const asset = assets.getByName('IconAddedNextBuild', 'svg');
const icon = assets.icons.WrenchIcon;
const unknownIcon = assets.icons.SomeUnknownIcon;

// A known name may still be missing at runtime, so every lookup can return `undefined`.
export type KnownReturns = Expect<Equal<typeof known, number | undefined>>;
export type LottieReturns = Expect<Equal<typeof lottie, number | undefined>>;
export type UnknownReturns = Expect<Equal<typeof unknown, number | undefined>>;
export type UnknownTypeReturns = Expect<Equal<typeof unknownType, number | undefined>>;
export type AssetReturns = Expect<Equal<typeof asset, Assets.UnboundAsset | undefined>>;
export type IconReturns = Expect<Equal<typeof icon, number | undefined>>;
export type UnknownIconReturns = Expect<Equal<typeof unknownIcon, number | undefined>>;
