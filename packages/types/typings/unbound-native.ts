import type { AddonManifest } from './addons';

/**
 * The native loader's origin and version.
 * @internal
 */
export type UnboundLoaderInfo = {
	origin: string;
	version: string;
	bytecodeVersion: number;
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

/**
 * A custom font file the native loader registered.
 * @internal
 */
export type UnboundFontFile = {
	name: string;
	file: string;
	path: string;
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
	/** The custom font files in Unbound's `Fonts` folder. */
	getFonts(): UnboundFontFile[];
	/** The font names Discord can already use, computed on the first call and cached natively. */
	getAvailableFonts(): string[];
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
