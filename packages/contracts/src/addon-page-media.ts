import type { AddonPageFrontmatter, MeasuredMedia, PageMedia } from './addon-page';
import type { SchemaIssue } from './schema-error';

/** A measured page, as the page contract's structure holds it. */
export type MeasuredPage = { frontmatter: AddonPageFrontmatter; media: MeasuredMedia[] };

/** The kinds of media a page can show. */
export const MEDIA_KINDS = ['image', 'video'] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Maps each lowercase file extension a page may reference to the kind of media it holds. */
export const MEDIA_EXTENSIONS: Record<string, MediaKind> = {
	png: 'image',
	jpg: 'image',
	jpeg: 'image',
	webp: 'image',
	gif: 'image',
	mp4: 'video',
	webm: 'video',
};

/** The smallest banner the store accepts, in pixels. */
export const BANNER_MIN_WIDTH = 1200;
export const BANNER_MIN_HEIGHT = 400;

/** The default size limits for one media file and for all of an addon's media together, in bytes. */
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_TOTAL_MAX_BYTES = 50 * 1024 * 1024;

/** The longest path, and the longest alt text, a page may use. */
export const MEDIA_PATH_MAX_LENGTH = 200;
export const MEDIA_ALT_MAX_LENGTH = 300;

/**
 * @description Reads the kind of media a file holds from its extension.
 * @param path The file's path or name.
 * @returns The kind, or `undefined` when the extension is not one a page may use.
 */
export function getMediaKind(path: string): MediaKind | undefined {
	const dot = path.lastIndexOf('.');

	if (dot === -1) {
		return undefined;
	}

	return MEDIA_EXTENSIONS[path.slice(dot + 1).toLowerCase()];
}

const UNDOTTED_SEGMENT = String.raw`[\w-][\w.-]*`;
const MEDIA_PATH = new RegExp(String.raw`^media/(?:${UNDOTTED_SEGMENT}/)*${UNDOTTED_SEGMENT}$`);

/**
 * @description Tells whether `value` is a path inside the page's `media/` folder to a file kind a page shows.
 * @param value The untrusted value.
 * @returns Whether the page may reference it.
 */
// UNKNOWN: a path read from frontmatter, Markdown or a measured page.
export function isMediaPath(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length <= MEDIA_PATH_MAX_LENGTH &&
		MEDIA_PATH.test(value) &&
		getMediaKind(value) !== undefined
	);
}

/** A rule on an alt text: the message it reports, or `undefined` when it passes. */
export type AltCheck = (value: string) => string | undefined;

/** The alt rules of the page contract, applied to the trimmed text. */
export const ALT_CHECKS: AltCheck[] = [
	(value) => (value.length < 1 ? 'Describe the media.' : undefined),
	(value) =>
		value.length > MEDIA_ALT_MAX_LENGTH
			? `Too big: expected string to have <=${MEDIA_ALT_MAX_LENGTH} characters`
			: undefined,
];

/**
 * @description Trims an alt text, as the page contract decodes it, and applies the alt rules.
 * @param value The alt text as `page.json` or ADDON.md wrote it.
 * @returns The trimmed text, or `undefined` when it breaks a rule.
 */
export function readAlt(value: string): string | undefined {
	const trimmed = value.trim();

	return ALT_CHECKS.every((check) => check(trimmed) === undefined) ? trimmed : undefined;
}

/**
 * @description Checks the banner shape: exactly 3:1 and at least 1200x400.
 * @param media The measured banner.
 * @returns Whether the store accepts it as a banner.
 */
export function isBannerAspect(media: MeasuredMedia): boolean {
	return (
		media.width === media.height * 3 &&
		media.width >= BANNER_MIN_WIDTH &&
		media.height >= BANNER_MIN_HEIGHT
	);
}

/**
 * @description Checks a gallery entry's shape: between 9:16 (portrait) and 21:9 (ultrawide), inclusive.
 * @param media The measured image or video.
 * @returns Whether the store accepts it in the gallery.
 */
export function isGalleryAspect(media: MeasuredMedia): boolean {
	return media.width * 16 >= media.height * 9 && media.width * 9 <= media.height * 21;
}

/**
 * @description Reports every way a measured page breaks the store's media rules: a file measured
 * twice, a referenced file that was not measured, and a banner or gallery entry of the wrong shape.
 * @param page The measured page, already checked against the page contract's structure.
 * @returns The issues found, in page order; an empty list passes.
 */
export function measuredPageIssues(page: MeasuredPage): SchemaIssue[] {
	const issues: SchemaIssue[] = [];
	const measured = new Map<string, MeasuredMedia>();

	for (const [index, media] of page.media.entries()) {
		if (measured.has(media.path)) {
			issues.push({
				path: `/media/${index}/path`,
				message: `${media.path} is measured twice.`,
			});
		}

		measured.set(media.path, media);
	}

	function find(path: string, at: string): MeasuredMedia | undefined {
		const media = measured.get(path);

		if (!media) {
			issues.push({ path: at, message: `${path} was not measured.` });
		}

		return media;
	}

	const banner = find(page.frontmatter.banner, '/frontmatter/banner');

	if (banner && !isBannerAspect(banner)) {
		issues.push({
			path: '/frontmatter/banner',
			message: `The banner must be exactly 3:1 and at least ${BANNER_MIN_WIDTH}x${BANNER_MIN_HEIGHT}; ${banner.path} is ${banner.width}x${banner.height}.`,
		});
	}

	for (const [index, entry] of page.frontmatter.media.entries()) {
		const at = `/frontmatter/media/${index}`;
		const media = 'image' in entry ? find(entry.image, at) : find(entry.video, at);

		if (media && !isGalleryAspect(media)) {
			issues.push({
				path: at,
				message: `Media must be between 9:16 and 21:9; ${media.path} is ${media.width}x${media.height}.`,
			});
		}

		if ('video' in entry && entry.poster) {
			find(entry.poster, `${at}/poster`);
		}
	}

	return issues;
}

/**
 * @description Tells whether every path a page uses holds a file of the kind it shows the file as: an
 * image for the banner, gallery images and posters, a video for gallery videos, and a measured file
 * whose `kind` matches its extension and which carries a duration only when it is a video.
 * @param page The measured page, already checked against the page contract's structure.
 * @returns Whether every path matches its kind.
 */
function usesMatchingKinds(page: MeasuredPage): boolean {
	if (getMediaKind(page.frontmatter.banner) !== 'image') {
		return false;
	}

	for (const entry of page.frontmatter.media) {
		if ('image' in entry) {
			if (getMediaKind(entry.image) !== 'image') {
				return false;
			}

			continue;
		}

		if (getMediaKind(entry.video) !== 'video') {
			return false;
		}

		if (entry.poster !== undefined && getMediaKind(entry.poster) !== 'image') {
			return false;
		}
	}

	for (const media of page.media) {
		if (media.kind !== getMediaKind(media.path)) {
			return false;
		}

		if (media.kind !== 'video' && media.duration !== undefined) {
			return false;
		}
	}

	return true;
}

/**
 * @description Reads a measured `page.json` the way the page contract does: the media rules hold, every
 * path matches the kind it is shown as, and each alt text is trimmed. Runs on device, where the page is
 * rendered; the page's structure is checked by the caller.
 * @param page The value, already checked against the page contract's structure.
 * @returns The page with trimmed alt texts, or `undefined` when a rule fails.
 */
export function readMeasuredPage(page: MeasuredPage): MeasuredPage | undefined {
	if (measuredPageIssues(page).length > 0 || !usesMatchingKinds(page)) {
		return undefined;
	}

	const media: PageMedia[] = [];

	for (const entry of page.frontmatter.media) {
		const alt = readAlt(entry.alt);

		if (alt === undefined) {
			return undefined;
		}

		media.push({ ...entry, alt });
	}

	return { frontmatter: { ...page.frontmatter, media }, media: page.media };
}

export default {
	MEDIA_KINDS,
	MEDIA_EXTENSIONS,
	BANNER_MIN_WIDTH,
	BANNER_MIN_HEIGHT,
	MEDIA_MAX_BYTES,
	MEDIA_TOTAL_MAX_BYTES,
	MEDIA_PATH_MAX_LENGTH,
	MEDIA_ALT_MAX_LENGTH,
	getMediaKind,
	isMediaPath,
	ALT_CHECKS,
	readAlt,
	isBannerAspect,
	isGalleryAspect,
	measuredPageIssues,
	readMeasuredPage,
};
