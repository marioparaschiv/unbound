import { parseDocument } from 'yaml';

import { z } from './zod';

/** The file in an addon's directory that holds its store page. */
export const ADDON_PAGE_FILENAME = 'ADDON.md';

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

// Media are repository files under `media/`; segments may not start with a dot, so `..` cannot escape it.
export const mediaPathSchema = z.string().check(
	z.maxLength(200),
	z.regex(
		/^media\/(?:[\w-][\w.-]*\/)*[\w-][\w.-]*$/,
		'Must be a relative path inside the media/ folder.',
	),
	z.refine((path) => getMediaKind(path) !== undefined, {
		message: `Must end in ${Object.keys(MEDIA_EXTENSIONS).join(', ')}.`,
		abort: true,
	}),
);

export const imagePathSchema = mediaPathSchema.check(
	z.refine((path) => getMediaKind(path) === 'image', 'Must be an image.'),
);

export const videoPathSchema = mediaPathSchema.check(
	z.refine((path) => getMediaKind(path) === 'video', 'Must be a video.'),
);

const altSchema = z
	.string()
	.check(z.trim(), z.minLength(1, 'Describe the media.'), z.maxLength(300));

/** One gallery entry: an image, or a video with an optional poster image. */
export const pageMediaSchema = z.union([
	z.strictObject({ image: imagePathSchema, alt: altSchema }),
	z.strictObject({ video: videoPathSchema, poster: z.optional(imagePathSchema), alt: altSchema }),
]);

/** The YAML frontmatter of ADDON.md. The title and description come from the manifest, so neither is allowed. */
export const addonPageFrontmatterSchema = z.strictObject({
	banner: imagePathSchema,
	media: z._default(z.array(pageMediaSchema).check(z.maxLength(20)), []),
});

const pixelsSchema = z.int().check(z.positive());

/** One media file as `ubd build` measured it. */
export const measuredMediaSchema = z
	.object({
		path: mediaPathSchema,
		kind: z.enum(MEDIA_KINDS),
		width: pixelsSchema,
		height: pixelsSchema,
		/** The video's length in seconds. */
		duration: z.optional(z.number().check(z.positive())),
		/** The base64 ThumbHash placeholder shown while the file loads. */
		thumbhash: z.string().check(z.regex(/^[A-Za-z0-9+/]{1,64}={0,2}$/, 'Must be base64.')),
		bytes: z.int().check(z.positive()),
	})
	.check(
		z.refine(
			(media) => media.kind === getMediaKind(media.path),
			'The kind must match the file extension.',
		),
		z.refine(
			(media) => media.kind === 'video' || media.duration === undefined,
			'Only a video has a duration.',
		),
	);

export type PageMedia = z.infer<typeof pageMediaSchema>;
export type AddonPageFrontmatter = z.infer<typeof addonPageFrontmatterSchema>;
export type MeasuredMedia = z.infer<typeof measuredMediaSchema>;

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
export const addonPageSchema = z
	.object({
		frontmatter: addonPageFrontmatterSchema,
		media: z.array(measuredMediaSchema),
	})
	.check(
		z.superRefine((page, ctx) => {
			const measured = new Map<string, MeasuredMedia>();

			for (const [index, media] of page.media.entries()) {
				if (measured.has(media.path)) {
					ctx.addIssue({
						code: 'custom',
						message: `${media.path} is measured twice.`,
						path: ['media', index, 'path'],
					});
				}

				measured.set(media.path, media);
			}

			function find(path: string, at: PropertyKey[]): MeasuredMedia | undefined {
				const media = measured.get(path);

				if (!media) {
					ctx.addIssue({
						code: 'custom',
						message: `${path} was not measured.`,
						path: at,
					});
				}

				return media;
			}

			const banner = find(page.frontmatter.banner, ['frontmatter', 'banner']);

			if (banner && !isBannerAspect(banner)) {
				ctx.addIssue({
					code: 'custom',
					message: `The banner must be exactly 3:1 and at least ${BANNER_MIN_WIDTH}x${BANNER_MIN_HEIGHT}; ${banner.path} is ${banner.width}x${banner.height}.`,
					path: ['frontmatter', 'banner'],
				});
			}

			for (const [index, entry] of page.frontmatter.media.entries()) {
				const at = ['frontmatter', 'media', index];
				const media = 'image' in entry ? find(entry.image, at) : find(entry.video, at);

				if (media && !isGalleryAspect(media)) {
					ctx.addIssue({
						code: 'custom',
						message: `Media must be between 9:16 and 21:9; ${media.path} is ${media.width}x${media.height}.`,
						path: at,
					});
				}

				if ('video' in entry && entry.poster) {
					find(entry.poster, [...at, 'poster']);
				}
			}
		}),
	);

export type AddonPage = z.infer<typeof addonPageSchema>;

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

	const parsed = addonPageFrontmatterSchema.safeParse(document.toJS() ?? {});

	if (!parsed.success) {
		return { success: false, error: z.prettifyError(parsed.error) };
	}

	return { success: true, frontmatter: parsed.data, body };
}

export default {
	ADDON_PAGE_FILENAME,
	MEDIA_KINDS,
	MEDIA_EXTENSIONS,
	BANNER_MIN_WIDTH,
	BANNER_MIN_HEIGHT,
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
