import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

/** A typebox entry module the generated checks take helpers from. */
export type TypeboxModule = 'format' | 'guard' | 'hashing' | 'schema';

// The package entries only re-export namespaces, and member access keeps every export, so helpers
// come from the deep module that implements them.
/** The deep module each namespace's runtime helpers live in. */
const modules: Record<TypeboxModule, string> = {
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
 * @description Bundles exports of the installed typebox copy into source with no imports, so the
 * generated checks keep typebox's exact behavior without shipping the package.
 * @param module The typebox entry module the exports come from.
 * @param names The exported names to inline.
 * @returns Source that defines the exports' original names and binds them to `e0`..`eN`.
 */
export function inlineExports(module: TypeboxModule, names: string[]): Promise<Inlined> {
	const key = `${module}:${names.join(',')}`;
	const cached = pending.get(key);

	if (cached) {
		return cached.then((code) => ({ code, bindings: bindings(names) }));
	}

	const source = inline(module, names);

	pending.set(
		key,
		source.then((inlined) => inlined.code),
	);

	return source;
}

function bindings(names: string[]): string[] {
	return names.map((_, index) => `e${index}`);
}

async function inline(module: TypeboxModule, names: string[]): Promise<Inlined> {
	const path = modules[module];
	const entry = [
		...names.map((name, index) => `import { ${name} as i${index} } from ${quoted(path)};`),
		...names.map((_, index) => `export const e${index} = i${index};`),
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
		throw new Error(`Failed to inline ${names.join(', ')} from typebox/${module}.`);
	}

	const code = chunk.code
		.replace(/^export \{[^}]*\};?$/m, '')
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('//'))
		.join('\n')
		.trim();

	if (code.includes('export ')) {
		throw new Error(`Inlined typebox/${module} source still has exports: ${names.join(', ')}.`);
	}

	return { code, bindings: bindings(names) };
}

function quoted(value: string): string {
	return JSON.stringify(value);
}
