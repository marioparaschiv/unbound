import { transformAsync, type BabelFileResult } from '@babel/core';
import { createRequire } from 'node:module';
import Logger from '@unbound-app/logger';
import type { Plugin } from 'rolldown';

const logger = Logger.create('Build', 'React Compiler');

// Anchored to this build package, as Babel otherwise resolves plugins from the process cwd.
const require = createRequire(import.meta.url);
const compilerPlugin = require.resolve('babel-plugin-react-compiler');

type CompilerEvent = { kind: string };

/** What the compiler did to one module. */
type CompileStats = { compiled: number; skipped: number };

/**
 * @description Runs the React Compiler over one TypeScript module, memoising its components and hooks.
 * @param code The module's source.
 * @param id The module's path.
 * @param dev Whether this is a local dev build, whose hot refresh needs each cache reset when its file changes.
 * @param stats Counts the functions compiled, and those left as written because the compiler could not prove them safe.
 * @returns Babel's result: the compiled module and its source map.
 */
export async function compileModule(
	code: string,
	id: string,
	dev: boolean,
	stats: CompileStats = { compiled: 0, skipped: 0 },
): Promise<BabelFileResult | null> {
	return transformAsync(code, {
		filename: id,
		babelrc: false,
		configFile: false,
		parserOpts: { plugins: ['jsx', 'typescript'] },
		plugins: [
			[
				compilerPlugin,
				{
					target: '19',
					// A function the compiler cannot prove safe keeps its source instead of failing the build.
					panicThreshold: 'none',
					environment: {
						enableResetCacheOnSourceFileChanges: dev,
						// Shared values change outside render, so their `.value` reads are never memoised.
						enableCustomTypeDefinitionForReanimated: true,
					},
					logger: {
						logEvent(_file: string, event: CompilerEvent) {
							if (event.kind === 'CompileSuccess') {
								stats.compiled++;
							}

							if (event.kind === 'CompileError') {
								stats.skipped++;
							}
						},
					},
				},
			],
		],
		sourceMaps: true,
	});
}

/**
 * @description Memoises components and hooks with the React Compiler. The output imports
 * `react/compiler-runtime`, which the client shims to Discord's React 19 runtime.
 * @param dev Whether this is a local dev build, whose hot refresh needs each cache reset when its file changes.
 * @returns A rolldown plugin running the compiler on source files.
 */
export default function reactCompiler(dev: boolean): Plugin {
	let stats: CompileStats = { compiled: 0, skipped: 0 };

	return {
		name: 'react-compiler',
		buildStart() {
			stats = { compiled: 0, skipped: 0 };
		},
		transform: {
			// Before the dev build's refresh transform, whose prelude would sit above a module's `'use no memo'`.
			order: 'pre',
			filter: {
				id: { include: /\.tsx?$/, exclude: /node_modules/ },
				// Components render JSX and hooks start with `use`; anything else has nothing to compile.
				code: { include: /\/>|<\/|\buse[A-Z]/ },
			},
			async handler(code, id) {
				const result = await compileModule(code, id, dev, stats);

				return result?.code ? { code: result.code, map: result.map } : undefined;
			},
		},
		buildEnd() {
			logger.log(
				`Compiled ${stats.compiled} components and hooks; left ${stats.skipped} as written.`,
			);
		},
	};
}
