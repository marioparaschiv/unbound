import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { BUNDLE_PATTERN, DIST_DIR } from './constants';
import { gitRevision } from '../build/constants';

const SOURCE_DIRS = [join(DIST_DIR, '..', 'src')];

/** One built bundle in `dist/`: when it was written, and whether client sources changed after that. */
export type BundleBuild = { file: string; builtAt: string; stale: boolean };

/** What `/__build` reports: the checkout's revision, the newest source change, the bundle last served and every bundle. */
export type BuildInfo = {
	revision: string;
	sourcesChangedAt: string | undefined;
	served: string | undefined;
	bundles: BundleBuild[];
};

let served: string | undefined;

/**
 * @description Remembers the bundle the server last sent to a device, so the build report can say which one devices run.
 * @param file The bundle's file name inside `dist/`.
 */
export function noteServed(file: string): void {
	if (BUNDLE_PATTERN.test(file)) {
		served = file;
	}
}

function newestChange(dir: string): number {
	let newest = 0;

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);

		if (entry.isDirectory()) {
			newest = Math.max(newest, newestChange(path));
		} else if (entry.isFile()) {
			newest = Math.max(newest, statSync(path).mtimeMs);
		}
	}

	return newest;
}

function sourcesChangedAt(): number | undefined {
	try {
		return Math.max(...SOURCE_DIRS.map(newestChange));
	} catch {
		return undefined;
	}
}

function builtBundles(changedAt: number | undefined): BundleBuild[] {
	try {
		return readdirSync(DIST_DIR)
			.filter((file) => BUNDLE_PATTERN.test(file))
			.map((file) => {
				const builtAt = statSync(join(DIST_DIR, file)).mtimeMs;

				return {
					file,
					builtAt: new Date(builtAt).toISOString(),
					stale: changedAt !== undefined && changedAt > builtAt,
				};
			});
	} catch {
		return [];
	}
}

/**
 * @description Reads how current the built bundles are against the client's sources.
 * @returns The checkout's revision, when sources last changed, the bundle last served and each bundle's build time.
 */
export function readBuildInfo(): BuildInfo {
	const changedAt = sourcesChangedAt();

	return {
		revision: gitRevision(),
		sourcesChangedAt: changedAt === undefined ? undefined : new Date(changedAt).toISOString(),
		served,
		bundles: builtBundles(changedAt),
	};
}

/**
 * @description Describes the served bundle when it is older than the client's sources.
 * @param info The build report.
 * @returns A warning to print, or `undefined` while the served bundle is current or nothing was served yet.
 */
export function staleWarning(info: BuildInfo): string | undefined {
	const bundle = info.bundles.find((entry) => entry.file === info.served);

	if (!bundle?.stale) {
		return undefined;
	}

	return `${bundle.file} was built at ${bundle.builtAt}, before the client sources changed at ${info.sourcesChangedAt}; rebuild the client (bun run build:dev in packages/client) so devices get the change.`;
}
