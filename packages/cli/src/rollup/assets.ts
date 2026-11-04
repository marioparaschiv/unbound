import {
	ASSETS_DIRECTORY,
	getAssetPath,
	isAssetName,
	type AssetType,
} from '@unbound-app/contracts/addon-assets';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import type { AddonAsset } from '@unbound-app/types/addons';
import { parseSync, Visitor } from 'rolldown/utils';
import { createHash } from 'node:crypto';
import type { Plugin } from 'rollup';

import { reportProblem } from './diagnostic.ts';

/** The scales an image ships at, as its `@2x` and `@3x` suffixes name them. */
export type AssetScale = '1' | '2' | '3';

/** One image: its asset name, type, and its file at each scale found beside it. */
export type AssetGroup = {
	name: string;
	type: AssetType;
	files: Map<AssetScale, string>;
};

/** The images one build's modules imported, shared by the main build and its lazy modules' builds. */
export type AssetCollector = {
	imported: Map<string, AssetGroup>;
};

const IMAGE_FILE = /^(.+?)(?:@([23])x)?\.(png|jpe?g|webp|gif)$/i;
const UNSUPPORTED_IMAGE = /\.(bmp|tiff?|heic|heif|avif|ico)$/i;
const SVG_FILE = /\.svg$/i;
const IMPORT_PREFIX = '\0unbound-asset:';
// The `ubd check` id these plugins report under.
const CHECK = 'assets';
const SCALES: AssetScale[] = ['1', '2', '3'];

/**
 * @description Creates the record of imported images that {@link assetImports} fills and {@link assets} ships.
 * @returns An empty collector.
 */
export function createAssetCollector(): AssetCollector {
	return { imported: new Map() };
}

function unsupported(path: string): string {
	const type = path.slice(path.lastIndexOf('.') + 1).toLowerCase();

	return `${path} is ${type}, which React Native's Image cannot draw; plugins ship png, jpg, webp or gif images, and svg as components.`;
}

/**
 * @description Names the asset a file is: its path without extension or scale, relative to `assets/` inside it and to the plugin root outside it.
 * @param pluginRoot The plugin's directory.
 * @param path The file.
 * @param base The file name without its extension and scale suffix.
 * @returns The name; throws when it is not path-safe.
 */
export function assetNameOf(pluginRoot: string, path: string, base: string): string {
	const directory = dirname(path);
	const folder = join(pluginRoot, ASSETS_DIRECTORY);
	const root = directory === folder || directory.startsWith(folder + sep) ? folder : pluginRoot;
	const name = toPosix(relative(root, join(directory, base)));

	if (!isAssetName(name)) {
		throw new Error(
			`${path} cannot name an asset; use letters, digits, "_", "-" and "." only.`,
		);
	}

	return name;
}

function toPosix(path: string): string {
	return path.split(sep).join('/');
}

/**
 * @description Reads an image file and its scale siblings (`star.png`, `star@2x.png`, `star@3x.png`) as one asset.
 * The name is the path without extension or scale, relative to `assets/` inside it and to the plugin root outside it.
 * @param pluginRoot The plugin's directory.
 * @param path Any of the image's files.
 * @returns The asset; throws when the file is not a supported image or its name is not path-safe.
 */
export function readAssetGroup(pluginRoot: string, path: string): AssetGroup {
	const match = IMAGE_FILE.exec(basename(path));

	if (!match) {
		throw new Error(
			UNSUPPORTED_IMAGE.test(path) ? unsupported(path) : `${path} is not an image.`,
		);
	}

	const [, base = '', , extension = ''] = match;
	const directory = dirname(path);
	const name = assetNameOf(pluginRoot, path, base);
	const files = new Map<AssetScale, string>();

	for (const scale of SCALES) {
		const file = join(directory, `${base}${scale === '1' ? '' : `@${scale}x`}.${extension}`);

		if (existsSync(file)) {
			files.set(scale, file);
		}
	}

	const lower = extension.toLowerCase();

	return { name, type: lower === 'jpeg' ? 'jpg' : (lower as AssetType), files };
}

function listFiles(directory: string): string[] {
	return readdirSync(directory, { recursive: true, encoding: 'utf8' })
		.filter((entry) => !entry.split(sep).some((segment) => segment.startsWith('.')))
		.map((entry) => join(directory, entry))
		.filter((path) => statSync(path).isFile());
}

/**
 * @description Reads every image in a plugin's `assets/` folder, one group per name.
 * @param pluginRoot The plugin's directory.
 * @returns The assets by name; throws naming a file that is not a supported image, or two images sharing a name.
 */
export function readAssetFolder(pluginRoot: string): Map<string, AssetGroup> {
	const folder = join(pluginRoot, ASSETS_DIRECTORY);
	const groups = new Map<string, AssetGroup>();

	if (!existsSync(folder)) {
		return groups;
	}

	// An SVG is imported as a component, so it never ships as a file.
	for (const path of listFiles(folder).filter((file) => !SVG_FILE.test(file))) {
		const group = readAssetGroup(pluginRoot, path);
		const known = groups.get(group.name);

		if (known && known.type !== group.type) {
			throw new Error(`Two images in ${folder} are named ${group.name}; rename one.`);
		}

		groups.set(group.name, group);
	}

	return groups;
}

/**
 * @description Resolves a relative or `~/` import of an image to a module whose default export is the image's
 * registered asset id, and records the image so {@link assets} ships it. An unsupported image type fails the build.
 * @param pluginRoot The plugin's directory.
 * @param collector Where imported images are recorded.
 * @returns The rollup plugin.
 */
export function assetImports(pluginRoot: string, collector: AssetCollector): Plugin {
	return {
		name: 'unbound-asset-imports',
		resolveId(source, importer) {
			const local = source.startsWith('.') || source.startsWith('~/');
			const image =
				(IMAGE_FILE.test(source) || UNSUPPORTED_IMAGE.test(source)) &&
				!SVG_FILE.test(source);

			if (!local || !image) return null;

			const path = source.startsWith('~/')
				? resolve(pluginRoot, 'src', source.slice(2))
				: resolve(importer ? dirname(importer) : pluginRoot, source);

			if (UNSUPPORTED_IMAGE.test(path)) {
				reportProblem(this, CHECK, pluginRoot, {
					file: importer ?? '',
					severity: 'error',
					message: unsupported(path),
				});
			}

			// `star.png` may ship only as `star@2x.png` or `star@3x.png`.
			const variants = [
				path,
				...['2', '3'].map((scale) => path.replace(/(\.\w+)$/, `@${scale}x$1`)),
			];

			if (!variants.some((variant) => existsSync(variant))) {
				reportProblem(this, CHECK, pluginRoot, {
					file: importer ?? '',
					severity: 'error',
					message: `${source}, imported from ${importer ?? 'the entry'}, does not exist`,
				});
			}

			return `${IMPORT_PREFIX}${path}`;
		},
		load(id) {
			if (!id.startsWith(IMPORT_PREFIX)) return null;

			const group = readAssetGroup(pluginRoot, id.slice(IMPORT_PREFIX.length));

			for (const file of group.files.values()) this.addWatchFile(file);

			collector.imported.set(group.name, group);

			return [
				"import { assets } from '@unbound-app/api';",
				`export default assets.getIdByName(${JSON.stringify(group.name)});`,
			].join('\n');
		},
	};
}

type Measured = { width: number; height: number };

async function measure(path: string, scale: AssetScale): Promise<Measured> {
	const { default: sharp } = await import('sharp');
	const { width, height, pageHeight } = await sharp(path).metadata();
	const factor = Number(scale);

	if (!width || !height) {
		throw new Error(`${path} has no readable width and height.`);
	}

	return {
		width: Math.max(1, Math.round(width / factor)),
		height: Math.max(1, Math.round((pageHeight ?? height) / factor)),
	};
}

/**
 * @description Collects every string a chunk spells out whole: each string literal, and each template literal
 * without substitutions, read from oxc's AST.
 * @param code The chunk's code.
 * @returns The strings.
 */
export function readStringLiterals(code: string): Set<string> {
	const { program } = parseSync('chunk.js', code, { lang: 'js', sourceType: 'script' });
	const strings = new Set<string>();

	new Visitor({
		Literal(node) {
			if (typeof node.value === 'string') {
				strings.add(node.value);
			}
		},
		TemplateLiteral(node) {
			const [only] = node.quasis;

			if (node.expressions.length === 0 && only?.value.cooked) {
				strings.add(only.value.cooked);
			}
		},
	}).visit(program);

	return strings;
}

/**
 * @description Ships a plugin's images: every imported one, and each image in `assets/` whose name the bundle
 * spells out as a whole string, as `assets.getIdByName('<name>')` does. Each file is emitted once beside the bundle as
 * `assets/<sha256>.<type>`, and `assets` in the dist manifest lists each image's size and files.
 * @param pluginRoot The plugin's directory.
 * @param collector The images the build's modules imported.
 * @returns The rollup plugin.
 */
export function assets(pluginRoot: string, collector: AssetCollector): Plugin {
	let folder = new Map<string, AssetGroup>();

	return {
		name: 'unbound-assets',
		buildStart() {
			collector.imported.clear();

			try {
				folder = readAssetFolder(pluginRoot);
			} catch (error) {
				reportProblem(this, CHECK, pluginRoot, {
					file: ASSETS_DIRECTORY,
					severity: 'error',
					message: (error as Error).message,
				});
			}

			for (const group of folder.values()) {
				for (const file of group.files.values()) this.addWatchFile(file);
			}
		},
		async generateBundle(_options, bundle) {
			const manifest = bundle['manifest.json'];

			if (manifest?.type !== 'asset') return;

			const named = new Set(
				Object.values(bundle).flatMap((output) =>
					output.type === 'chunk' ? [...readStringLiterals(output.code)] : [],
				),
			);
			const shipped = new Map(collector.imported);

			for (const [name, group] of folder) {
				if (shipped.has(name)) {
					continue;
				}

				if (named.has(name)) {
					shipped.set(name, group);
				} else {
					reportProblem(this, CHECK, pluginRoot, {
						file: `${ASSETS_DIRECTORY}/${name}.${group.type}`,
						severity: 'warning',
						message: `is not imported and the bundle never names "${name}", so it is left out`,
						fix: `import it, or delete it`,
					});
				}
			}

			if (!shipped.size) return;

			const parsed = JSON.parse(String(manifest.source));
			const listed: Record<string, AddonAsset> = {};
			const emitted = new Set<string>();

			for (const [name, group] of [...shipped].sort(([a], [b]) => a.localeCompare(b))) {
				const [first] = [...group.files];

				if (!first) {
					continue;
				}

				const size = await measure(first[1], first[0]);
				const scales: AddonAsset['scales'] = {};

				for (const [scale, path] of group.files) {
					const bytes = readFileSync(path);
					const sha256 = createHash('sha256').update(bytes).digest('hex');
					const fileName = getAssetPath(parsed.main, sha256, group.type);

					scales[scale] = sha256;

					if (!emitted.has(fileName)) {
						emitted.add(fileName);
						this.emitFile({ type: 'asset', fileName, source: bytes });
					}
				}

				listed[name] = { type: group.type, ...size, scales };
			}

			manifest.source = `${JSON.stringify({ ...parsed, assets: listed }, null, '\t')}\n`;
		},
	};
}

export default {
	createAssetCollector,
	readAssetGroup,
	readAssetFolder,
	readStringLiterals,
	assetImports,
	assets,
};
