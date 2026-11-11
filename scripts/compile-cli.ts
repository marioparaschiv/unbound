import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import type { BunPlugin } from 'bun';

const ROOT = join(import.meta.dir, '..');
const ENTRY = join(ROOT, 'packages/cli/src/index.ts');

// terminal-kit, the bridge REPL's renderer, requires files by computed paths a bundle cannot follow.
// Its eager entry and a static config table let the bridge run inside the compiled binary.
const terminalKit: BunPlugin = {
	name: 'terminal-kit-static-requires',
	setup(build) {
		build.onResolve({ filter: /^terminal-kit$/ }, (args) => ({
			path: Bun.resolveSync('terminal-kit/lib/termkit-no-lazy-require.js', args.resolveDir),
		}));
		// Its own modules reach the lazy entry through relative requires.
		build.onResolve({ filter: /^\.\.?\/termkit\.js$/ }, (args) => ({
			path: Bun.resolveSync(
				args.path.replace('termkit.js', 'termkit-no-lazy-require.js'),
				args.resolveDir,
			),
		}));

		build.onLoad({ filter: /terminal-kit[\\/]lib[\\/]Terminal\.js$/ }, async (args) => {
			const configs = readdirSync(join(dirname(args.path), 'termconfig')).filter((file) =>
				file.endsWith('.js'),
			);
			const table = configs
				.map((file) => `${JSON.stringify(file)}: () => require('./termconfig/${file}')`)
				.join(',\n');
			const source = await Bun.file(args.path).text();
			const patched = source.replaceAll(
				"require( './termconfig/' + term.termconfigFile )",
				'requireTermconfig( term.termconfigFile )',
			);

			if (patched === source) {
				throw new Error(
					`Failed to patch terminal-kit's termconfig requires in ${args.path}.`,
				);
			}

			return {
				loader: 'js',
				contents: `${patched}\nfunction requireTermconfig(file) {\n\tconst load = {\n${table}\n}[file];\n\tif (!load) throw new Error('Cannot find module ./termconfig/' + file);\n\treturn load();\n}\n`,
			};
		});
	},
};

/**
 * @description Compiles `ubd` into one executable that needs no Bun or node_modules, for the
 * desktop DevTools to ship beside it. Usage: `bun scripts/compile-cli.ts <outfile> [target]`.
 */
async function main() {
	const [outfile, target] = process.argv.slice(2);

	if (!outfile) {
		throw new Error(
			'Usage: bun scripts/compile-cli.ts <outfile> [target, such as bun-windows-x64]',
		);
	}

	const result = await Bun.build({
		entrypoints: [ENTRY],
		compile: { outfile, ...(target ? { target: target as Bun.Build.CompileTarget } : {}) },
		minify: true,
		plugins: [terminalKit],
	});

	if (!result.success) {
		for (const log of result.logs) {
			console.error(log);
		}

		process.exit(1);
	}

	console.log(`Compiled ubd to ${outfile}.`);
}

await main();
