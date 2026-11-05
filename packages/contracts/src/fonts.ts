import { Type, type StaticDecode } from './schema';

/** Where a resolved font comes from. `url` is any direct font or archive link. */
export const FONT_PROVIDERS = [
	'google',
	'fontsource',
	'fontshare',
	'fontsquirrel',
	'dafont',
	'github',
	'url',
] as const;

export const fontProviderSchema = Type.Enum(FONT_PROVIDERS);

export const fontStyleSchema = Type.Enum(['normal', 'italic']);

/** `font` is one `.ttf`/`.otf` file; `archive` is a zip the loader unpacks. */
export const fontFileKindSchema = Type.Enum(['font', 'archive']);

/** The longest input the resolver reads: a family name or a link. */
export const MAX_FONT_INPUT_LENGTH = 2048;

/** The most files one resolved font lists: 9 weights, upright and italic, with room to spare. */
export const MAX_FONT_FILES = 64;

/**
 * One downloadable file. `weight` and `style` are `null` when only the file itself says, as for
 * direct links and archives; the loader reads them from the font.
 */
export const fontFileSchema = Type.Object({
	url: Type.String({ format: 'url', pattern: /^https:\/\//i }),
	kind: fontFileKindSchema,
	weight: Type.Union([Type.Integer({ minimum: 1, maximum: 1000 }), Type.Null()]),
	style: Type.Union([fontStyleSchema, Type.Null()]),
});

export const resolveFontQuerySchema = Type.Object({
	input: Type.String({ minLength: 1, maxLength: MAX_FONT_INPUT_LENGTH }),
});

/**
 * A font resolved to the provider's own file URLs. Unbound never hosts the files. `id` names the
 * family at its provider, such as `Inter` on Google or `inter` on Fontsource, so a pack can refer to it.
 */
export const resolvedFontSchema = Type.Object({
	provider: fontProviderSchema,
	id: Type.String({ minLength: 1 }),
	family: Type.String({ minLength: 1 }),
	files: Type.Array(fontFileSchema, { minItems: 1, maxItems: MAX_FONT_FILES }),
});

export type FontProvider = StaticDecode<typeof fontProviderSchema>;
export type FontStyle = StaticDecode<typeof fontStyleSchema>;
export type FontFile = StaticDecode<typeof fontFileSchema>;
export type ResolvedFont = StaticDecode<typeof resolvedFontSchema>;

export default {
	FONT_PROVIDERS,
	MAX_FONT_FILES,
	MAX_FONT_INPUT_LENGTH,
	fontFileKindSchema,
	fontFileSchema,
	fontProviderSchema,
	fontStyleSchema,
	resolveFontQuerySchema,
	resolvedFontSchema,
};
