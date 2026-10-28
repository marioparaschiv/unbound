import { addonIdSchema, addonMainSchema } from '@unbound-app/contracts/manifest';

const FONT_EXTENSION = /\.(?:ttf|otf|ttc|woff2?)$/i;
const FONT_NAME_UNSAFE = /[^\w .()-]+/g;

/**
 * @description Names the bundle compiled to Hermes bytecode beside a source bundle, as the loader looks it up.
 * @param path The source bundle's path or URL, such as `dist/index.js`.
 * @param bytecodeVersion The Hermes bytecode version.
 * @returns The compiled bundle's path, such as `dist/index.98.hbc`.
 */
export function compiledBundlePath(path: string, bytecodeVersion: number): string {
	return `${path.replace(/\.[^./]+$/, '')}.${bytecodeVersion}.hbc`;
}

/**
 * @description Checks that an addon id can name its folder: alphanumeric segments joined by ".", "_" or "-".
 * @param id The id from a manifest.
 * @returns Whether the id is safe to use as a folder name.
 */
export function isSafeAddonId(id: unknown): id is string {
	return addonIdSchema.safeParse(id).success;
}

/**
 * @description Checks that a manifest's `main` stays inside the addon's folder.
 * @param main The `main` from a manifest.
 * @returns Whether `main` is a relative path inside the addon.
 */
export function isSafeAddonMain(main: unknown): main is string {
	return addonMainSchema.safeParse(main).success;
}

/**
 * @description Reads a path from a remote listing as a path inside a folder, rejecting anything that could leave it.
 * @param path The path from the listing.
 * @returns The path when every segment is a plain name, otherwise `undefined`.
 */
export function safeRelativePath(path: string): string | undefined {
	const segments = path.split('/');

	if (
		!path ||
		path.startsWith('/') ||
		path.includes('\\') ||
		path.includes('\0') ||
		segments.some((segment) => segment === '' || segment === '.' || segment === '..')
	) {
		return undefined;
	}

	return path;
}

/**
 * @description Names an installed font file after its URL, keeping only characters that are safe in a file name.
 * @param url The font's URL.
 * @param fallback The name to use when the URL has none.
 * @returns A file name with no path separators that does not start with a dot.
 */
export function safeFontFileName(url: string, fallback: string): string {
	const last = url.split(/[?#]/)[0]?.split('/').pop() ?? '';
	let decoded = last;

	try {
		decoded = decodeURIComponent(last);
	} catch {
		decoded = last;
	}

	const cleaned = decoded
		.replaceAll(FONT_NAME_UNSAFE, '-')
		.replace(/^[.\s-]+/, '')
		.slice(0, 120);

	return cleaned && FONT_EXTENSION.test(cleaned) ? cleaned : fallback;
}
