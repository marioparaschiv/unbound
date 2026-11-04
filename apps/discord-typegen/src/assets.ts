import { parseSync, Visitor, type ESTree } from 'rolldown/utils';

import type { ModuleRecord } from './types';

import { literalType, propertyKey } from './rules';
import { compare } from './naming';
import { BANNER } from './emit';

/** One asset a module registers with Discord's asset registry. */
export type AssetRecord = { name: string; type: string };

export const ASSETS_FILE = 'assets.gen.d.ts';

// Compiled intl catalogs: their names carry a content hash, so they change every build and no one looks them up.
const SKIPPED_TYPES = new Set(['jsona']);
// Every asset module passes the packager's record literal to `registerAsset`; this gates the parse.
const PACKAGER_FLAG = "'__packager_asset'";

function keyOf(property: ESTree.ObjectPropertyKind): string | undefined {
	if (property.type !== 'Property' || property.computed) return;

	const { key } = property;

	if (key.type === 'Identifier') {
		return key.name;
	}

	return key.type === 'Literal' && typeof key.value === 'string' ? key.value : void 0;
}

function readAsset(node: ESTree.ObjectExpression): AssetRecord | undefined {
	const fields = new Map<string, unknown>();

	for (const property of node.properties) {
		const key = keyOf(property);

		if (key !== void 0 && property.type === 'Property' && property.value.type === 'Literal') {
			fields.set(key, property.value.value);
		}
	}

	const name = fields.get('name');
	const type = fields.get('type');

	if (fields.get('__packager_asset') !== true) return;

	if (typeof name !== 'string' || typeof type !== 'string') return;

	return { name, type };
}

/**
 * @description Reads the assets a module registers: each object literal carrying `__packager_asset: true`, the
 * record Metro's asset modules pass to `registerAsset`.
 * @param module The module.
 * @returns Its assets, in source order; empty for modules that register none.
 */
export function collectAssets(module: ModuleRecord): AssetRecord[] {
	if (!module.source.includes(PACKAGER_FLAG)) {
		return [];
	}

	const { program, errors } = parseSync(`m${module.id}.js`, module.source);

	if (errors.length > 0) {
		throw new Error(`Failed to parse asset module ${module.id}: ${errors[0]!.message}`);
	}

	const assets: AssetRecord[] = [];

	new Visitor({
		ObjectExpression(node) {
			const asset = readAsset(node);

			if (asset) {
				assets.push(asset);
			}
		},
	}).visit(program);

	return assets;
}

/**
 * @description Groups assets into sorted, de-duplicated names per file type, leaving out {@link SKIPPED_TYPES}.
 * @param assets Every asset the build registers.
 * @returns File type to its asset names, both sorted.
 */
export function namesByType(assets: AssetRecord[]): Map<string, string[]> {
	const groups = new Map<string, Set<string>>();

	for (const { name, type } of assets) {
		if (SKIPPED_TYPES.has(type)) {
			continue;
		}

		groups.set(type, (groups.get(type) ?? new Set()).add(name));
	}

	return new Map(
		[...groups]
			.sort(([a], [b]) => compare(a, b))
			.map(([type, names]) => [type, [...names].sort(compare)]),
	);
}

/**
 * @description Prints the asset name types: `DiscordAssetNames` maps each file type to the union of its names.
 * @param build The build's name, printed in the docs.
 * @param names File type to its asset names, from {@link namesByType}.
 * @returns The text of {@link ASSETS_FILE}.
 */
export function emitAssets(build: string, names: Map<string, string[]>): string {
	const members = [...names].map(([type, list]) => {
		const union = list.map((name) => `\t\t| ${literalType(name)}`).join('\n');

		return `\t${propertyKey(type)}:\n${union};`;
	});

	return `${[
		BANNER,
		// Holds the banner, so a bundler inlining these types drops it instead of attaching it to the first alias.
		'export {};',
		'',
		`/** The names of the assets Discord ${build} registers, by file type, as \`assets.getIdByName\` takes them. */`,
		`export type DiscordAssetNames = {\n${members.join('\n')}\n};`,
		'',
		'/** A file type Discord registers assets of. */',
		'export type DiscordAssetType = keyof DiscordAssetNames;',
		'',
		'/** The name of an asset Discord registers, of the given file types. */',
		'export type DiscordAssetName<T extends DiscordAssetType = DiscordAssetType> = DiscordAssetNames[T];',
	].join('\n')}\n`;
}

export default { ASSETS_FILE, collectAssets, namesByType, emitAssets };
