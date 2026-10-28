import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const HERMESC_MANIFEST_URL =
	'https://raw.githubusercontent.com/unbound-app/hermesc/main/manifest.json';

const hermesJson = resolve(__dirname, 'hermes.json');

export type HermescPackage = {
	npm: string;
};

export type HermescManifest = {
	latest: number[];
	versions: Record<string, HermescPackage>;
};

export type HermesConfig = {
	bytecodeVersions: number[];
};

/**
 * @description Picks the bytecode versions the build compiles: every version `hermes.json` declares,
 * plus any newer one the hermesc manifest publishes. It never drops a version, since Discord may still
 * run it; dropping one is a deliberate edit to `hermes.json`.
 * @param manifest The hermesc manifest.
 * @param current The bytecode versions `hermes.json` declares.
 * @returns The versions `hermes.json` should declare, newest first.
 */
export function nextBytecodeVersions(manifest: HermescManifest, current: number[]): number[] {
	const published = manifest.latest.filter((version) => manifest.versions[String(version)]);
	const oldest = current.length ? Math.min(...current) : (published[0] ?? 0);
	const newer = published.filter((version) => version > Math.max(...current, 0));

	return [...new Set([...newer, ...current])]
		.filter((version) => version >= oldest)
		.sort((left, right) => right - left);
}

/**
 * @description Counts how many of the hermesc manifest's newest versions a build must resolve so it
 * includes every version it ships, for builds that select hermesc by count.
 * @param latest The hermesc manifest's versions, newest first.
 * @param wanted The bytecode versions the build ships.
 * @returns The count to resolve.
 */
export function hermescCount(latest: number[], wanted: number[]): number {
	const positions = wanted.map((version) => latest.indexOf(version));
	const missing = wanted.filter((_, index) => (positions[index] ?? -1) < 0);

	if (missing.length) {
		throw new Error(`hermesc does not publish bytecode ${missing.join(', ')}.`);
	}

	return Math.max(...positions, 0) + 1;
}

/**
 * @description Reports whether two version lists name the same versions in the same order.
 * @param left One list.
 * @param right The other.
 * @returns Whether they are equal.
 */
export function sameVersions(left: number[], right: number[]): boolean {
	return left.length === right.length && left.every((version, index) => version === right[index]);
}

async function main(): Promise<void> {
	const response = await fetch(HERMESC_MANIFEST_URL);

	if (!response.ok) {
		throw new Error(`Fetching the hermesc manifest failed with ${response.status}.`);
	}

	const manifest = (await response.json()) as HermescManifest;
	const config = JSON.parse(readFileSync(hermesJson, 'utf8')) as HermesConfig;
	const next = nextBytecodeVersions(manifest, config.bytecodeVersions);

	if (next.length === 0) {
		throw new Error('The hermesc manifest publishes no bytecode versions.');
	}

	if (sameVersions(next, config.bytecodeVersions)) {
		console.log(`hermes.json already declares ${next.join(', ')}.`);

		return;
	}

	writeFileSync(
		hermesJson,
		`${JSON.stringify({ ...config, bytecodeVersions: next }, null, '\t')}\n`,
	);
	console.log(
		`hermes.json now declares ${next.join(', ')} (was ${config.bytecodeVersions.join(', ')}).`,
	);
}

if (import.meta.main) {
	await main();
}
