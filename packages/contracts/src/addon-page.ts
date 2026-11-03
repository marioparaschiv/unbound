import { parseDocument } from 'yaml';

import {
	ALT_CHECKS,
	BANNER_MIN_HEIGHT,
	BANNER_MIN_WIDTH,
	getMediaKind,
	isBannerAspect,
	isGalleryAspect,
	MEDIA_EXTENSIONS,
	MEDIA_KINDS,
	MEDIA_MAX_BYTES,
	MEDIA_PATH_MAX_LENGTH,
	MEDIA_TOTAL_MAX_BYTES,
	measuredPageIssues,
} from './addon-page-media';
import { ADDON_PAGE_FILENAME, MEASURED_PAGE_FILENAME, splitFrontmatter } from './addon-page-text';
import { safeParse, superRefine, trimmedString, Type, type StaticDecode } from './schema';

export {
	BANNER_MIN_HEIGHT,
	BANNER_MIN_WIDTH,
	getMediaKind,
	isBannerAspect,
	isGalleryAspect,
	isMediaPath,
	MEDIA_EXTENSIONS,
	MEDIA_KINDS,
	MEDIA_MAX_BYTES,
	MEDIA_TOTAL_MAX_BYTES,
	measuredPageIssues,
	readAlt,
	readMeasuredPage,
} from './addon-page-media';
export { ADDON_PAGE_FILENAME, MEASURED_PAGE_FILENAME, splitFrontmatter } from './addon-page-text';
export type { MeasuredPage, MediaKind } from './addon-page-media';
export type { SplitAddonPage } from './addon-page-text';

const UNDOTTED_SEGMENT = String.raw`[\w-][\w.-]*`;
const MEDIA_PATH = new RegExp(String.raw`^media/(?:${UNDOTTED_SEGMENT}/)*${UNDOTTED_SEGMENT}$`);

export const mediaPathSchema = Type.Refine(
	Type.String({
		maxLength: MEDIA_PATH_MAX_LENGTH,
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

const altSchema = trimmedString(...ALT_CHECKS);

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

/** The measured page `ubd build` writes to `{output}/page.json`: the frontmatter and every media file it measured. */
export const addonPageSchema = superRefine(
	Type.Object({
		frontmatter: addonPageFrontmatterSchema,
		media: Type.Array(measuredMediaSchema),
	}),
	measuredPageIssues,
);

export type AddonPage = StaticDecode<typeof addonPageSchema>;

/** The result of reading ADDON.md: its typed frontmatter and Markdown body, or why it was refused. */
export type ParsedAddonPage =
	| { success: true; frontmatter: AddonPageFrontmatter; body: string }
	| { success: false; error: string };

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
