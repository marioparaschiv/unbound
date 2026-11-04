import { createHash } from 'node:crypto';
import ts from 'typescript-api';

/** Parsed TypeScript files by content hash, and each program's last build, kept across check runs. */
export type TypeScriptCache = {
	files: Map<string, ts.SourceFile>;
	programs: Map<string, ts.Program>;
};

// Builds the bucket keys TypeScript's language service shares source files under.
const registry = ts.createDocumentRegistry();

/**
 * @description Creates an empty cache for TypeScript programs.
 * @returns The cache.
 */
export function createTypeScriptCache(): TypeScriptCache {
	return { files: new Map(), programs: new Map() };
}

/**
 * @description Creates a program whose source files come from the cache when their text is unchanged,
 * reusing the program last built under the same key, so a re-run parses only the edited files.
 * @param key Names the program across runs, such as `types:<addon dir>`.
 * @param rootNames The files the program starts from.
 * @param options The compiler options.
 * @param cache The cache to read and fill; a fresh program is built without one.
 * @returns The program.
 */
export function createCachedProgram(
	key: string,
	rootNames: readonly string[],
	options: ts.CompilerOptions,
	cache?: TypeScriptCache,
): ts.Program {
	if (!cache) {
		return ts.createProgram({ rootNames, options });
	}

	const host = ts.createCompilerHost(options);
	const settings = registry.getKeyForCompilationSettings(options);

	host.getSourceFile = (fileName, languageVersion, onError) => {
		const text = host.readFile(fileName);

		if (text === void 0) {
			onError?.(`Cannot read ${fileName}.`);

			return void 0;
		}

		const version =
			typeof languageVersion === 'object'
				? `${languageVersion.languageVersion}:${languageVersion.impliedNodeFormat}`
				: languageVersion;
		const id = `${fileName}\0${settings}\0${version}\0${createHash('sha1').update(text).digest('hex')}`;
		const cached = cache.files.get(id);

		if (cached) {
			return cached;
		}

		const file = ts.createSourceFile(fileName, text, languageVersion);

		cache.files.set(id, file);

		return file;
	};

	const program = ts.createProgram({
		rootNames,
		options,
		host,
		oldProgram: cache.programs.get(key),
	});

	cache.programs.set(key, program);

	return program;
}

export default { createTypeScriptCache, createCachedProgram };
