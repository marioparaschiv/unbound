import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

/** The format checkers `@unbound-app/contracts/formats` exports and registers with typebox. */
export const CONTRACT_FORMATS: readonly string[] = ['isDate', 'isDateTime', 'isUrl', 'isUuid'];

/** A module the generated checks take helpers from. */
export type HelperModule = 'contracts-format' | 'format' | 'guard' | 'hashing' | 'schema';

// The package entries only re-export namespaces, and member access keeps every export, so helpers
// come from the deep module that implements them.
/** The deep module each namespace's runtime helpers live in. */
const modules: Record<HelperModule, string> = {
	'contracts-format': fileURLToPath(
		new URL('../../../../contracts/src/formats.ts', import.meta.url).href,
	),
	format: fileURLToPath(import.meta.resolve('typebox/format')),
	guard: resolve(dirname(fileURLToPath(import.meta.resolve('typebox/guard'))), 'guard.mjs'),
	hashing: resolve(
		dirname(fileURLToPath(import.meta.resolve('typebox/system'))),
		'hashing/hash.mjs',
	),
	schema: fileURLToPath(import.meta.resolve('typebox/schema')),
};

const pending = new Map<string, Promise<string>>();

/** Standalone source for one set of exports, with `e0`..`eN` bound to them in order. */
export type Inlined = { code: string; bindings: string[] };

/**
 * @description Bundles exports of a helper module into source with no imports, so the generated
 * checks keep typebox's exact behavior without shipping the package.
 * @param module The entry module the exports come from.
 * @param names The exported names to inline.
 * @param prefix The binding prefix, so two modules' bindings cannot collide.
 * @returns Source that defines the exports' original names and binds them to `<prefix>0`..`<prefix>N`.
 */
export function inlineExports(
	module: HelperModule,
	names: string[],
	prefix = 'e',
): Promise<Inlined> {
	const key = `${module}:${prefix}:${names.join(',')}`;
	const source = pending.get(key) ?? inlineSource(module, names, prefix, key);

	return source.then((code) => ({ code, bindings: bindings(names, prefix) }));
}

function inlineSource(
	module: HelperModule,
	names: string[],
	prefix: string,
	key: string,
): Promise<string> {
	const inlined = inline(module, names, prefix);

	pending.set(
		key,
		inlined.then((result) => result.code),
	);

	return inlined.then((result) => result.code);
}

function bindings(names: string[], prefix: string): string[] {
	return names.map((_, index) => `${prefix}${index}`);
}

async function inline(module: HelperModule, names: string[], prefix: string): Promise<Inlined> {
	const path = modules[module];
	const entry = [
		...names.map((name, index) => `import { ${name} as i${index} } from ${quoted(path)};`),
		...names.map((_, index) => `export const ${prefix}${index} = i${index};`),
	].join('\n');
	const bundle = await rolldown({
		input: 'inline',
		plugins: [
			{
				name: 'inline',
				resolveId: (id) => (id === 'inline' ? id : null),
				load: (id) => (id === 'inline' ? entry : null),
			},
		],
		treeshake: { moduleSideEffects: false },
	});
	const { output } = await bundle.generate({ format: 'es', comments: false });

	await bundle.close();

	const chunk = output[0];

	if (chunk === undefined || !('code' in chunk)) {
		throw new Error(`Failed to inline ${names.join(', ')} from ${module}.`);
	}

	const code = chunk.code
		.replace(/^export \{[^}]*\};?$/m, '')
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('//'))
		.join('\n')
		.trim();

	if (code.includes('export ')) {
		throw new Error(`Inlined ${module} source still has exports: ${names.join(', ')}.`);
	}

	return { code, bindings: bindings(names, prefix) };
}

function quoted(value: string): string {
	return JSON.stringify(value);
}
