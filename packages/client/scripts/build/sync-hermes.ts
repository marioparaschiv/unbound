import type { HermesManifest, ManifestContext } from '@unbound-app/rollup-plugin-hermes/manifest';
import { parse, Type, type StaticDecode } from '@unbound-app/contracts/schema';
import { fetchManifest } from '@unbound-app/rollup-plugin-hermes/manifest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const hermesJson = resolve(__dirname, 'hermes.json');

const scriptContext: ManifestContext = {
	warn: (message) => console.warn(message),
	error: (message) => {
		throw new Error(message);
	},
};

// Keys other than `bytecodeVersions` are written back untouched.
const hermesConfigSchema = Type.Object(
	{ bytecodeVersions: Type.Array(Type.Number()) },
	{ additionalProperties: true },
);

export type HermesConfig = StaticDecode<typeof hermesConfigSchema>;

/**
 * @description Picks the bytecode versions the build compiles: every version `hermes.json` declares,
 * plus any newer one the hermesc manifest publishes. It never drops a version, since Discord may still
 * run it; dropping one is a deliberate edit to `hermes.json`.
 * @param manifest The hermesc manifest.
 * @param current The bytecode versions `hermes.json` declares.
 * @returns The versions `hermes.json` should declare, newest first.
 */
export function nextBytecodeVersions(manifest: HermesManifest, current: number[]): number[] {
	const published = manifest.latest.filter((version) => manifest.versions[String(version)]);
	const oldest = current.length ? Math.min(...current) : (published[0] ?? 0);
	const newer = published.filter((version) => version > Math.max(...current, 0));

	return [...new Set([...newer, ...current])]
		.filter((version) => version >= oldest)
		.sort((left, right) => right - left);
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
	const manifest = await fetchManifest(scriptContext);
	const config = parse(hermesConfigSchema, JSON.parse(readFileSync(hermesJson, 'utf8')));
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
