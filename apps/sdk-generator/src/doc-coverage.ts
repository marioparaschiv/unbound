import { Application, ReflectionKind, type DeclarationReflection, type Reflection } from 'typedoc';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createLogger } from '@unbound-app/logger';
import { z } from 'zod';

import { API_SRC, CLIENT, ROOT } from './paths';
import { createDocsOptions } from './docs';

const logger = createLogger('SDK', 'DocCoverage');

const typesManifestSchema = z.object({ types: z.string() });

/** The reflections a reader looks up by name, so each needs its own comment. */
const REQUIRED_KINDS =
	ReflectionKind.Function |
	ReflectionKind.Variable |
	ReflectionKind.TypeAlias |
	ReflectionKind.Class |
	ReflectionKind.Interface |
	ReflectionKind.Enum |
	ReflectionKind.EnumMember |
	ReflectionKind.Property |
	ReflectionKind.Method |
	ReflectionKind.Accessor;

const BUNDLER_SUFFIX = /\$\d+$/;

const EXPORTED_NAME =
	/export\s+(?:declare\s+)?(?:type|interface|const|let|function|class|enum)\s+([A-Za-z_$][\w$]*)/g;

// Bundled typings declare names first and export them in one list at the end.
const DECLARED_NAME = /(?:type|interface|const|let|function|class|enum)\s+([A-Za-z_$][\w$]*)/g;

/** An SDK reflection with no comment, and the source file to write it in when Unbound owns it. */
export type UndocumentedReflection = {
	name: string;
	kind: string;
	source: string | undefined;
};

function declaredNames(files: string[], pattern: RegExp): Map<string, string> {
	const names = new Map<string, string>();

	for (const file of files) {
		for (const [, name] of readFileSync(file, 'utf8').matchAll(pattern)) {
			if (name && !names.has(name)) {
				names.set(name, relative(ROOT, file));
			}
		}
	}

	return names;
}

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { recursive: true, encoding: 'utf8' })
		.filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'))
		.map((file) => join(directory, file));
}

function possessTypings(): string {
	const manifest = Bun.resolveSync('possess/package.json', CLIENT);
	const { types } = typesManifestSchema.parse(JSON.parse(readFileSync(manifest, 'utf8')));

	return join(dirname(manifest), types);
}

function isDocumented(reflection: DeclarationReflection): boolean {
	return [
		reflection,
		...(reflection.signatures ?? []),
		reflection.getSignature,
		reflection.setSignature,
	].some((part) => part?.hasComment());
}

function topLevelName(reflection: Reflection): string {
	let top = reflection;

	while (top.parent && !top.parent.kindOf(ReflectionKind.SomeModule | ReflectionKind.Project)) {
		top = top.parent;
	}

	return top.name.replace(BUNDLER_SUFFIX, '');
}

// Members of an inline type, such as a parameter's `{ label }`, are documented by their owner's `@param`.
function isInline(reflection: Reflection): boolean {
	for (let parent = reflection.parent; parent; parent = parent.parent) {
		if (parent.kindOf(ReflectionKind.TypeLiteral | ReflectionKind.SomeSignature)) {
			return true;
		}
	}

	return false;
}

/**
 * @description Lists the SDK reflections that have no comment. Discord's generated typings and the
 * `possess` types the patcher re-exports are skipped: their shapes come from outside Unbound.
 * @param apiSrc The generated SDK tree.
 * @returns Each undocumented reflection, with the Unbound source file that declares it when known.
 */
export async function findUndocumented(
	apiSrc: string = API_SRC,
): Promise<UndocumentedReflection[]> {
	const foreign = declaredNames(
		[...sourceFiles(join(ROOT, 'packages', 'discord-types', 'src')), possessTypings()],
		DECLARED_NAME,
	);
	const owned = declaredNames(
		[
			...sourceFiles(join(ROOT, 'packages', 'types', 'typings')),
			...sourceFiles(join(CLIENT, 'src')),
		],
		EXPORTED_NAME,
	);
	const app = await Application.bootstrap({ ...createDocsOptions(apiSrc), validation: false });
	const project = await app.convert();

	if (!project) {
		throw new Error(`Failed to convert the SDK at ${apiSrc}.`);
	}

	const undocumented: UndocumentedReflection[] = [];

	for (const reflection of project.getReflectionsByKind(REQUIRED_KINDS)) {
		if (!reflection.isDeclaration() || isInline(reflection) || isDocumented(reflection)) {
			continue;
		}

		const owner = topLevelName(reflection);

		if (foreign.has(owner) && !owned.has(owner)) {
			continue;
		}

		undocumented.push({
			name: reflection.getFullName(),
			kind: ReflectionKind.singularString(reflection.kind),
			source: owned.get(owner),
		});
	}

	return undocumented;
}

if (import.meta.main) {
	const undocumented = await findUndocumented();
	const bySource = Map.groupBy(
		undocumented,
		(entry) => entry.source ?? 'a local type in the client or a generated declaration',
	);

	for (const [source, entries] of bySource) {
		console.log(`\n${source} (${entries.length})`);

		for (const { kind, name } of entries) console.log(`  ${kind} ${name}`);
	}

	if (undocumented.length > 0) {
		logger.error(`${undocumented.length} public SDK members have no documentation.`);
		process.exit(1);
	}

	logger.success('Every public SDK member Unbound declares is documented.');
}
