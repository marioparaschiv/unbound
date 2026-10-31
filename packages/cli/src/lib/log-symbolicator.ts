import { dirname, join, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

type Symbolicator = (trace: string) => string;

type SymbolicateModule = { createSymbolicator(bundle: string): Symbolicator };

const SYMBOLICATE_SCRIPT = join('scripts', 'build', 'symbolicate.ts');
const CLIENT_FROM_REPOSITORY = join('packages', 'client');
const BUNDLE_FILE = /^unbound\.(\d+)\.bundle$/;
const BYTECODE_VERSION_LINE = /bytecode version:? (\d+)/i;
const HERMES_FRAME = 'address at ';

/**
 * @description Finds the client package that holds the Hermes symbolicator: beside this CLI in the monorepo, or above the working directory.
 * @param start The directory to search upwards from.
 * @returns The `packages/client` directory, or `undefined` outside the monorepo.
 */
function findClientDirectory(start: string = process.cwd()): string | undefined {
	const sibling = resolve(import.meta.dirname, '..', '..', '..', 'client');

	if (existsSync(join(sibling, SYMBOLICATE_SCRIPT))) {
		return sibling;
	}

	for (let directory = resolve(start); ; directory = dirname(directory)) {
		const candidate = join(directory, CLIENT_FROM_REPOSITORY);

		if (existsSync(join(candidate, SYMBOLICATE_SCRIPT))) {
			return candidate;
		}

		if (dirname(directory) === directory) {
			return;
		}
	}
}

/**
 * @description Lists the Hermes bundles built into a client `dist` directory that carry a source map, by bytecode version.
 * @param dist The client's `dist` directory.
 * @returns Each bundle's path by its bytecode version.
 */
export function listBundles(dist: string): Map<number, string> {
	const bundles = new Map<number, string>();

	for (const name of existsSync(dist) ? readdirSync(dist) : []) {
		const version = BUNDLE_FILE.exec(name)?.[1];

		if (version && existsSync(join(dist, `${name}.map`))) {
			bundles.set(Number(version), join(dist, name));
		}
	}

	return bundles;
}

/**
 * @description Builds the `--symbolicate` step of a log tail: Hermes frames of the client bundle are rewritten to source positions. It starts with the given bundle, or the newest one built, and switches to the bundle of the bytecode version the loader reports once a log line names it.
 * @param load Loads the symbolicator for one bundle.
 * @param bundles The built bundles by bytecode version.
 * @param bundle The bundle to start with, overriding the newest.
 * @returns A function that rewrites the frames in one message.
 */
export function createFrameRewriter(
	load: (bundle: string) => Symbolicator,
	bundles: Map<number, string>,
	bundle?: string,
): (message: string) => string {
	const loaded = new Map<string, Symbolicator>();
	let active = bundle ?? bundles.get(Math.max(...bundles.keys()));

	return (message) => {
		const version = BYTECODE_VERSION_LINE.exec(message)?.[1];

		if (version && !bundle) {
			active = bundles.get(Number(version)) ?? active;
		}

		if (!active || !message.includes(HERMES_FRAME)) {
			return message;
		}

		let symbolicator = loaded.get(active);

		if (!symbolicator) {
			symbolicator = load(active);
			loaded.set(active, symbolicator);
		}

		return symbolicator(message);
	};
}

/**
 * @description Loads the client's Hermes symbolicator and builds the frame rewriter a log tail runs every message through.
 * @param bundle A bundle to resolve frames against instead of the newest in `packages/client/dist`.
 * @returns The rewriter, or why symbolication is unavailable.
 */
export async function loadFrameRewriter(
	bundle?: string,
): Promise<((message: string) => string) | { error: string }> {
	const client = findClientDirectory();

	if (!client) {
		return {
			error: '--symbolicate needs the Unbound monorepo: run ubd from inside it, where packages/client holds the symbolicator.',
		};
	}

	const dist = join(client, 'dist');
	const bundles = listBundles(dist);
	const explicit = bundle === void 0 ? void 0 : resolve(bundle);

	if (explicit && !existsSync(`${explicit}.map`)) {
		return { error: `${explicit}.map does not exist; build the client with its maps first.` };
	}

	if (!explicit && !bundles.size) {
		return {
			error: `${dist} holds no Hermes bundle with a map. Build the client first (bun run build in packages/client).`,
		};
	}

	const module = (await import(
		pathToFileURL(join(client, SYMBOLICATE_SCRIPT)).href
	)) as SymbolicateModule;

	return createFrameRewriter((path) => module.createSymbolicator(path), bundles, explicit);
}
