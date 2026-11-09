import type { AddonManifest } from './addons';

/**
 * The native loader's origin and version.
 * @internal
 */
export type UnboundLoaderInfo = {
	origin: string;
	version: string;
	bytecodeVersion: number;
	/** The loader version the newest bundle needs, set while this loader refused it as too old. */
	requiredVersion?: string;
};

/**
 * An installed addon's manifest and bundle source, as the native loader read them.
 * @internal
 */
export type UnboundAddonBundle = {
	manifest: AddonManifest;
	bundle: string;
};

/**
 * A plugin the native loader read: its source, or only the source's SHA-256 when it runs from bytecode.
 * @internal
 */
export type UnboundPluginBundle = UnboundAddonBundle | { manifest: AddonManifest; sha256: string };

/** A face's style. @internal */
export type UnboundFontStyle = 'normal' | 'italic';

/** Where a font comes from, as `@unbound-app/contracts/fonts` names providers. @internal */
export type UnboundFontProvider =
	| 'google'
	| 'fontsource'
	| 'fontshare'
	| 'fontsquirrel'
	| 'dafont'
	| 'github'
	| 'url';

/**
 * Where one face came from: `{ google: 'Inter', weight: 400, style: 'normal' }`, `{ url: 'https://…' }`,
 * or `{ local: name }` for a font file with no source. Presets hold these instead of files.
 * @internal
 */
export type UnboundFontSource = (
	| { [P in UnboundFontProvider]: { [K in P]: string } }[UnboundFontProvider]
	| { local: string }
) & {
	weight?: number;
	style?: UnboundFontStyle;
};

/**
 * One installed face in the loader's font store.
 * @internal
 */
export type UnboundInstalledFont = {
	/** The store id: the face's PostScript name with only `[A-Za-z0-9._-]`. */
	id: string;
	family: string;
	postScriptName: string;
	fullName: string;
	weight: number;
	style: UnboundFontStyle;
	/** The file, relative to Unbound's `Fonts` folder. */
	file: string;
	/** The file's absolute path; `list()` adds it. */
	path?: string;
	source: UnboundFontSource;
};

/**
 * A Discord font family from `Constants.Fonts`, such as `ggsans-Semibold` in groups `PRIMARY` and `DISPLAY`.
 * @internal
 */
export type UnboundDiscordFamily = {
	groups: string[];
	weight: number;
	style: UnboundFontStyle;
};

/**
 * The font store: installed faces, the override map (Discord family to face id) and Discord's families.
 * @internal
 */
export type UnboundFontList = {
	fonts: UnboundInstalledFont[];
	overrides: Record<string, string>;
	families: Record<string, UnboundDiscordFamily>;
};

/**
 * A saved snapshot of the override map, keyed by Discord family and holding sources, not files.
 * @internal
 */
export type UnboundFontPreset = {
	id: string;
	name: string;
	overrides: Record<string, UnboundFontSource>;
};

/** How `fonts.setTargets` reaches Unbound's API. @internal */
export type UnboundFontTargetOptions = {
	/** The API origin the loader resolves fonts through; its built-in default when omitted. */
	api?: string;
};

/** A preset to save: an `id` replaces that preset, and no `overrides` snapshots the current ones. @internal */
export type UnboundFontPresetDraft = {
	id?: string;
	name: string;
	overrides?: Record<string, UnboundFontSource>;
};

/** A weight and style to install. @internal */
export type UnboundFontVariant = {
	weight: number;
	style: UnboundFontStyle;
};

/** One downloadable file of a resolved font; `null` weight and style are read from the file. @internal */
export type UnboundResolvedFontFile = {
	url: string;
	kind: 'font' | 'archive';
	weight: number | null;
	style: UnboundFontStyle | null;
};

/** A font resolved to its provider's file URLs. @internal */
export type UnboundResolvedFont = {
	provider: UnboundFontProvider;
	id: string;
	family: string;
	files: UnboundResolvedFontFile[];
};

/** What `fonts.install` installed, and the files it skipped and why. @internal */
export type UnboundFontInstallResult = {
	installed: UnboundInstalledFont[];
	errors: string[];
};

/** What `fonts.applyPreset` did with each Discord family of the preset. @internal */
export type UnboundFontPresetResult = {
	applied: string[];
	/** Families whose face failed to install; they keep Discord's font. */
	unavailable: string[];
	/** Families Discord no longer has. */
	skipped: string[];
	errors: string[];
};

/**
 * `UnboundNative.fonts`: the loader owns font state; JS only calls these and renders. `list` and
 * `listPresets` answer at once; the others run off the JS thread and reject with what failed.
 * @internal
 */
export type UnboundNativeFonts = {
	list(): UnboundFontList;
	resolve(input: string): Promise<UnboundResolvedFont>;
	/** Installs `input`'s files whose weight and style are in `variants`, or every file. */
	install(input: string, variants?: UnboundFontVariant[]): Promise<UnboundFontInstallResult>;
	remove(id: string): Promise<void>;
	/** Points a Discord family, or a whole group such as `PRIMARY`, at a face; `null` clears it. */
	setOverride(family: string, fontId: string | null): Promise<void>;
	/** Passes Discord's `Constants.Fonts` once, and the API origin the loader resolves fonts through. */
	setTargets(fonts: Record<string, string>, options?: UnboundFontTargetOptions): void;
	listPresets(): UnboundFontPreset[];
	/** Saves a preset; without `overrides` it snapshots the current ones. */
	savePreset(preset: UnboundFontPresetDraft): Promise<UnboundFontPreset>;
	applyPreset(id: string): Promise<UnboundFontPresetResult>;
	removePreset(id: string): Promise<void>;
};

/** An app icon the loader offers, as `getAppIcons` returns it. */
export type UnboundAppIcon = {
	/** The icon's native id, which the loader applies. */
	id: string;
	/** The id of Discord's own picker entry this icon replaces, when it replaces one. */
	pickerId?: string;
	/** The name shown in the icon picker. */
	name: string;
	/** A URI of the icon's preview image. */
	image: string;
};

/**
 * Launch data the loader publishes as `globalThis.UnboundNative`.
 * @internal
 */
export type UnboundNativeBridge = {
	/** The loader's origin, version and the runtime's Hermes bytecode version. */
	getLoader(): UnboundLoaderInfo;
	/** The installed plugins the loader scanned. */
	getPlugins(): UnboundPluginBundle[];
	/**
	 * The installed themes; each `bundle` is the raw `bundle.json` text, not an object. `JSON.parse` of it
	 * beat building the object over JSI (0.28 vs 0.41 ms, 800 colours), and update checks hash its exact bytes.
	 */
	getThemes(): UnboundAddonBundle[];
	getAppIcons?(): UnboundAppIcon[];
	/**
	 * Rereads only the installed themes, so `getThemes` lists ones installed, updated or deleted since launch and native
	 * views take the applied theme's new colours. Missing on a loader from before it.
	 */
	rescanThemes?(): void;
	syncAppIcons?(): void;
	installHomeScreenIcon?(name: string, imagePath: string): boolean;
	/** The font store; missing on a loader from before it. */
	fonts?: UnboundNativeFonts;
	/**
	 * The SHA-256 of a string's UTF-8 bytes in lowercase hex, lone surrogates as U+FFFD. The startup update
	 * check hashes every source-run plugin: 2.5 MB took 1.7 s in JS and 14 ms here on the vphone.
	 */
	getSha256(text: string): string;
	/**
	 * Saves a URL's response to a path inside Unbound's folder, off the JS thread, so the bytes never
	 * cross to JS as base64. Rejects on a path that leaves the folder or a status other than 200.
	 */
	downloadFile(url: string, path: string): Promise<void>;
};
