import { mediaPathSchema } from '@unbound-app/contracts/addon-page';
import type { SourcePin } from '@unbound-app/contracts/source';

/** The part of a source pin a relative ADDON.md URL resolves against. */
export type MarkdownPin = Pick<SourcePin, 'repository' | 'commitSha' | 'path'>;

/** Where a markdown URL may lead, and whether it leaves the page. */
export type MarkdownUrl = {
	href: string;
	external: boolean;
};

/** What the URL is written for: a link's `href` or an image's `src`. */
export type MarkdownUrlKind = 'link' | 'image';

const SCHEME = /^([a-z][a-z\d+.-]*):/i;
const WEB_SCHEMES = new Set(['http', 'https']);
const RESOLVE_ORIGIN = 'https://addon.invalid';

// Browsers strip tabs and newlines inside a URL, so `java\tscript:` would run as `javascript:`.
function hasControlCharacter(text: string): boolean {
	for (let i = 0, len = text.length; i < len; i++) {
		const code = text.charCodeAt(i);

		if (code < 0x20 || code === 0x7f) {
			return true;
		}
	}

	return false;
}

function toWebUrl(url: string): MarkdownUrl | undefined {
	try {
		return { href: new URL(url).href, external: true };
	} catch {
		return;
	}
}

// Resolving against a placeholder origin normalises `./` and `..` and stops `..` at the root.
// A result on another origin means the input was protocol-relative (`//host`, `/\host`).
function toPinnedUrl(url: string, pin: MarkdownPin): MarkdownUrl | undefined {
	const directory = pin.path ? `/${pin.path}/` : '/';
	const resolved = new URL(url, RESOLVE_ORIGIN + directory);

	if (resolved.origin !== RESOLVE_ORIGIN) return;

	const target = `${resolved.pathname}${resolved.search}${resolved.hash}`;

	return {
		href: `https://github.com/${pin.repository}/blob/${pin.commitSha}${target}`,
		external: true,
	};
}

/**
 * @description Decides where an ADDON.md URL may lead: web and mail links as written, fragments in
 * place, relative paths to the file at the pinned commit, and nothing else.
 * @param url The URL as written in the markdown.
 * @param pin The repository, commit and addon directory the markdown was read from.
 * @param kind Whether the URL is a link's target or an image's source; images never resolve to a fragment or mail address.
 * @returns The safe URL and whether it leaves the page, or `undefined` when the URL is dropped.
 */
export function resolveMarkdownUrl(
	url: string,
	pin: MarkdownPin,
	kind: MarkdownUrlKind,
): MarkdownUrl | undefined {
	const trimmed = url.trim();

	if (!trimmed || hasControlCharacter(trimmed)) return;

	if (trimmed.startsWith('#')) {
		return kind === 'link' ? { href: trimmed, external: false } : undefined;
	}

	const scheme = SCHEME.exec(trimmed)?.[1]?.toLowerCase();

	if (scheme === undefined) {
		return toPinnedUrl(trimmed, pin);
	}

	if (WEB_SCHEMES.has(scheme)) {
		return toWebUrl(trimmed);
	}

	if (scheme === 'mailto' && kind === 'link') {
		return { href: trimmed, external: true };
	}

	return;
}

/**
 * @description Finds where an addon's files load from before publish: its directory at the pinned commit.
 * @param pin The repository, commit and addon directory the page was read from.
 * @returns The directory URL on raw.githubusercontent.com, ending in `/`.
 */
export function getPinnedMediaBase(pin: MarkdownPin): string {
	const directory = pin.path ? `${pin.path}/` : '';

	return `https://raw.githubusercontent.com/${pin.repository}/${pin.commitSha}/${directory}`;
}

/**
 * @description Finds where an addon's files load from after publish: the CDN folder of the version.
 * @param manifestUrl The published version's `manifest.json` URL, which sits in that folder.
 * @returns The version folder URL, ending in `/`.
 */
export function getPublishedMediaBase(manifestUrl: string): string {
	return new URL('./', manifestUrl).href;
}

/**
 * @description Resolves an ADDON.md media path, such as `media/shot.png`, under a media base.
 * @param path The path as written in the page.
 * @param base The directory URL from {@link getPinnedMediaBase} or {@link getPublishedMediaBase}.
 * @returns The file's URL, or `undefined` when the path is not a file inside `media/`.
 */
export function resolveMediaUrl(path: string, base: string): string | undefined {
	if (!mediaPathSchema.safeParse(path).success) return;

	return new URL(path, base).href;
}

export default { resolveMarkdownUrl, getPinnedMediaBase, getPublishedMediaBase, resolveMediaUrl };
