import { availableParallelism } from 'node:os';
import { execFile } from 'node:child_process';

import type { AddonDiagnostics } from '~/lib/check/run';
import type { DiscoveredAddon } from '~/lib/discovery';
import { diagnostic } from '~/rollup/diagnostic';
import { parseJson } from '~/lib/parse-json';
import { Type } from '~/lib/schema';

const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
// Each process holds its own TypeScript and rollup state, about half a gigabyte for a large plugin.
const MAX_SHARDS = 8;

const shardOutputSchema = Type.Object({
	diagnostics: Type.Array(
		Type.Object({
			dir: Type.String(),
			file: Type.String(),
			line: Type.Number(),
			column: Type.Number(),
			path: Type.Optional(Type.String()),
			severity: Type.Union([Type.Literal('error'), Type.Literal('warning')]),
			message: Type.String(),
			fix: Type.Optional(Type.String()),
			check: Type.Optional(Type.String()),
		}),
	),
});

function runShard(entry: string, args: readonly string[], addons: DiscoveredAddon[]) {
	const plugins = addons.flatMap((addon) => ['--plugin', addon.dir]);

	return new Promise<string>((done, fail) => {
		// `ubd check` exits 1 when it finds errors; only a missing report is a failure.
		execFile(
			process.execPath,
			[entry, 'check', '--json', ...args, ...plugins],
			{ maxBuffer: MAX_OUTPUT_BYTES },
			(error, stdout, stderr) => {
				if (stdout.trim()) {
					done(stdout);
				} else {
					fail(
						new Error(stderr.trim() || error?.message || 'ubd check printed nothing.'),
					);
				}
			},
		);
	});
}

async function checkShard(
	entry: string,
	args: readonly string[],
	addons: DiscoveredAddon[],
): Promise<AddonDiagnostics[]> {
	try {
		const parsed = parseJson(
			await runShard(entry, args, addons),
			shardOutputSchema,
			'ubd check',
		);

		if (!parsed.ok) {
			throw new Error(parsed.error);
		}

		return addons.map((addon) => ({
			addon,
			diagnostics: parsed.value.diagnostics
				.filter((found) => found.dir === addon.dir)
				.map(({ dir: _dir, ...found }) => found),
		}));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return addons.map((addon) => ({
			addon,
			diagnostics: [
				diagnostic({
					file: '',
					severity: 'error',
					message: `Failed to check ${addon.id}: ${message}`,
				}),
			],
		}));
	}
}

/**
 * @description Checks many addons across up to one `ubd check` process per core, since the
 * TypeScript checks hold a process's only thread. Each process gets a share of the addons as `--plugin` flags.
 * @param addons The addons to check.
 * @param args The flags that pick the checks, such as `--only lint`, passed to every process.
 * @param entry The CLI entry to run; the running one by default.
 * @returns Each addon's diagnostics, in the order of `addons`.
 */
export async function checkInShards(
	addons: readonly DiscoveredAddon[],
	args: readonly string[],
	entry = process.argv[1] ?? '',
): Promise<AddonDiagnostics[]> {
	const count = Math.min(addons.length, availableParallelism(), MAX_SHARDS);
	const shards = Array.from({ length: count }, (_, index) =>
		addons.filter((_addon, position) => position % count === index),
	);
	const results = (
		await Promise.all(shards.map((shard) => checkShard(entry, args, shard)))
	).flat();
	const byDir = new Map(results.map((result) => [result.addon.dir, result]));

	return addons.flatMap((addon) => byDir.get(addon.dir) ?? []);
}

export default checkInShards;
