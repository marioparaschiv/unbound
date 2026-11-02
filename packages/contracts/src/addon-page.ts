import { parseDocument } from 'yaml';

import {
	safeParse,
	type SchemaIssue,
	superRefine,
	trimmedString,
	Type,
	type StaticDecode,
} from './schema';

/** The file in an addon's directory that holds its store page. */
export const ADDON_PAGE_FILENAME = 'ADDON.md';

/** The file `ubd build` writes the measured page to, in the addon's output directory. */
export const MEASURED_PAGE_FILENAME = 'page.json';

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

const FRONTMATTER = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

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

export const mediaPathSchema = Type.Refine(
	Type.String({
		maxLength: 200,
		pattern: MEDIA_PATH,
		errorMessage: 'Must be a relative path inside the media/ folder.',
	}),
	(path) => getMediaKind(path) !== undefined,
	() => `Must end in ${Object.keys(MEDIA_EXTENSIONS).join(', ')}.`,
);

export const imagePathSchema = Type.Refine(
	mediaPathSchema,
	(path) => getMediaKind(path) === 'image',
	() => 'Must be an image.',
);

export const videoPathSchema = Type.Refine(
	mediaPathSchema,
	(path) => getMediaKind(path) === 'video',
	() => 'Must be a video.',
);

const altSchema = trimmedString(
	(value) => (value.length < 1 ? 'Describe the media.' : undefined),
	(value) =>
		value.length > 300 ? 'Too big: expected string to have <=300 characters' : undefined,
);

/** One gallery entry: an image, or a video with an optional poster image. */
export const pageMediaSchema = Type.Union([
	Type.Object({ image: imagePathSchema, alt: altSchema }, { additionalProperties: false }),
	Type.Object(
		{ video: videoPathSchema, poster: Type.Optional(imagePathSchema), alt: altSchema },
		{ additionalProperties: false },
	),
]);

/** The YAML frontmatter of ADDON.md. The title and description come from the manifest, so neither is allowed. */
export const addonPageFrontmatterSchema = Type.Object(
	{
		banner: imagePathSchema,
		media: Type.Array(pageMediaSchema, { maxItems: 20, default: [] }),
	},
	{ additionalProperties: false },
);

const pixelsSchema = Type.Integer({ exclusiveMinimum: 0 });

/** One media file as `ubd build` measured it. */
export const measuredMediaSchema = Type.Refine(
	Type.Refine(
		Type.Object({
			path: mediaPathSchema,
			kind: Type.Enum(MEDIA_KINDS),
			width: pixelsSchema,
			height: pixelsSchema,
			/** The video's length in seconds. */
			duration: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
			/** The base64 ThumbHash placeholder shown while the file loads. */
			thumbhash: Type.String({
				pattern: /^[A-Za-z0-9+/]{1,64}={0,2}$/,
				errorMessage: 'Must be base64.',
			}),
			bytes: Type.Integer({ exclusiveMinimum: 0 }),
		}),
		(media) => media.kind === getMediaKind(media.path),
		() => 'The kind must match the file extension.',
	),
	(media) => media.kind === 'video' || media.duration === undefined,
	() => 'Only a video has a duration.',
);

export type PageMedia = StaticDecode<typeof pageMediaSchema>;
export type AddonPageFrontmatter = StaticDecode<typeof addonPageFrontmatterSchema>;
export type MeasuredMedia = StaticDecode<typeof measuredMediaSchema>;

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

/** The measured page `ubd build` writes to `{output}/page.json`: the frontmatter and every media file it measured. */
export const addonPageSchema = superRefine(
	Type.Object({
		frontmatter: addonPageFrontmatterSchema,
		media: Type.Array(measuredMediaSchema),
	}),
	(page) => {
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
	},
);

export type AddonPage = StaticDecode<typeof addonPageSchema>;

/** ADDON.md cut at its frontmatter fences. */
export type SplitAddonPage = {
	/** The YAML between the `---` fences, or `undefined` when the file has none. */
	frontmatter: string | undefined;
	body: string;
};

/** The result of reading ADDON.md: its typed frontmatter and Markdown body, or why it was refused. */
export type ParsedAddonPage =
	| { success: true; frontmatter: AddonPageFrontmatter; body: string }
	| { success: false; error: string };

/**
 * @description Cuts ADDON.md into its YAML frontmatter and its Markdown body.
 * @param source The file's text.
 * @returns The YAML between the leading `---` fences and the Markdown after them.
 */
export function splitFrontmatter(source: string): SplitAddonPage {
	const match = FRONTMATTER.exec(source);

	if (!match) {
		return { frontmatter: undefined, body: source };
	}

	return { frontmatter: match[1] ?? '', body: source.slice(match[0].length) };
}

/**
 * @description Reads ADDON.md's frontmatter as YAML and validates it against the page contract.
 * @param source The file's text.
 * @returns The frontmatter and body, or the first YAML error or every schema issue.
 */
export function parseAddonPage(source: string): ParsedAddonPage {
	const { frontmatter, body } = splitFrontmatter(source);
	const document = parseDocument(frontmatter ?? '');
	const [yamlError] = document.errors;

	if (yamlError) {
		return { success: false, error: `The frontmatter is not valid YAML: ${yamlError.message}` };
	}

	const parsed = safeParse(addonPageFrontmatterSchema, document.toJS() ?? {});

	if (!parsed.success) {
		return { success: false, error: parsed.error.message };
	}

	return { success: true, frontmatter: parsed.data, body };
}

export default {
	ADDON_PAGE_FILENAME,
	MEASURED_PAGE_FILENAME,
	MEDIA_KINDS,
	MEDIA_EXTENSIONS,
	BANNER_MIN_WIDTH,
	BANNER_MIN_HEIGHT,
	MEDIA_MAX_BYTES,
	MEDIA_TOTAL_MAX_BYTES,
	mediaPathSchema,
	imagePathSchema,
	videoPathSchema,
	pageMediaSchema,
	addonPageFrontmatterSchema,
	measuredMediaSchema,
	addonPageSchema,
	getMediaKind,
	isBannerAspect,
	isGalleryAspect,
	splitFrontmatter,
	parseAddonPage,
};
