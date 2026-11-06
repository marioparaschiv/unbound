import { validateAddonNaming } from '@unbound-app/contracts/addon-conventions';

import type { SemanticColors } from '~/lib/theme-maker/theme-semantic';
import type { RawColors, ThemeBase } from '~/lib/theme-maker/ramp';
import { createZip } from '~/lib/zip';

/** What the user typed to name and credit a theme. */
export type ThemeDraft = {
	name: string;
	authorName: string;
	/** The author's Discord user id. */
	authorId: string;
};

/** A theme's manifest, in the shape `packages/themes` ships. */
export type ThemeManifest = {
	id: string;
	name: string;
	description: string;
	authors: { name: string; id: string }[];
	version: string;
	icon: string;
	main: string;
};

/** A theme's bundle: the Discord theme it falls back to, its semantic overrides and its raw palette. */
export type ThemeBundle = {
	type: ThemeBase;
	semantic: SemanticColors;
	raw: RawColors;
};

/** A theme as the files a static addon folder holds. */
export type ThemeFiles = {
	folder: string;
	manifest: ThemeManifest;
	bundle: ThemeBundle;
};

const DISCORD_ID = /^\d{17,20}$/;

function toKebab(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * @description Builds a theme's folder name, manifest and bundle from the draft and the generated raws.
 * @param draft The theme's name and author.
 * @param raw The generated raw colours.
 * @param base The Discord theme it builds on.
 * @param semantic The semantic overrides.
 * @returns The theme's files.
 */
export function buildThemeFiles(
	draft: ThemeDraft,
	raw: RawColors,
	base: ThemeBase = 'dark',
	semantic: SemanticColors = {},
): ThemeFiles {
	const name = draft.name.trim();
	const folder = toKebab(name);
	const author = toKebab(draft.authorName);
	// An id's namespace must start with a letter.
	const namespace = /^[a-z]/.test(author) ? author : `theme-${author || 'author'}`;

	return {
		folder,
		manifest: {
			id: `${namespace}.${folder}`,
			name,
			description: `${name}, a ${base} theme made with the Unbound theme maker.`,
			authors: [{ name: draft.authorName.trim(), id: draft.authorId.trim() }],
			version: '1.0.0',
			icon: 'PaintPaletteIcon',
			main: 'bundle.json',
		},
		bundle: { type: base, semantic, raw },
	};
}

/**
 * @description Checks a theme's files against the naming conventions submissions are reviewed by.
 * @param files The theme's files.
 * @returns Every problem found, empty when the theme can be submitted.
 */
export function validateThemeFiles({ folder, manifest }: ThemeFiles): string[] {
	const errors = validateAddonNaming(manifest, folder);
	const [author] = manifest.authors;

	if (!author?.name) {
		errors.push('author must have a name');
	}

	if (!DISCORD_ID.test(author?.id ?? '')) {
		errors.push('author must have a Discord user ID');
	}

	return errors;
}

/**
 * @description Packs a theme as a zip of its folder: `<folder>/manifest.json` and `<folder>/bundle.json`.
 * @param files The theme's files.
 * @returns The zip's bytes.
 */
export function zipThemeFiles({ folder, manifest, bundle }: ThemeFiles): Uint8Array<ArrayBuffer> {
	const encoder = new TextEncoder();
	const json = (value: ThemeManifest | ThemeBundle) =>
		encoder.encode(JSON.stringify(value, null, '\t') + '\n');

	return createZip([
		{ path: `${folder}/manifest.json`, data: json(manifest) },
		{ path: `${folder}/bundle.json`, data: json(bundle) },
	]);
}

export default { buildThemeFiles, validateThemeFiles, zipThemeFiles };
