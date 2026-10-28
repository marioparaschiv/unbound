import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const bundledModule = fileURLToPath(new URL('../src/bundled.ts', import.meta.url));

function listed(source, constant) {
	const match = source.match(new RegExp(`export const ${constant} = \\[([^\\]]*)\\]`));

	if (!match) throw new Error(`${constant} is missing from src/bundled.ts`);

	return [...match[1].matchAll(/'([^']+)'/g)].map(([, name]) => name);
}

export async function generateLazyBundled(source) {
	const languages = listed(source, 'BUNDLED_LANGUAGES');
	const themes = listed(source, 'BUNDLED_THEMES');
	const registrations = new Map();
	const grammarNames = {};

	for (const key of languages) {
		const grammar = (await import(`@shikijs/langs/${key}`)).default;
		const order = grammar.map((language) => language.name);

		for (const language of grammar) {
			if (!registrations.has(language.name))
				registrations.set(language.name, JSON.stringify(language));

			for (const name of [language.name, ...(language.aliases ?? [])]) {
				grammarNames[name] = order;
			}
		}
	}

	const themeSources = [];

	for (const key of themes) {
		themeSources.push(JSON.stringify((await import(`@shikijs/themes/${key}`)).default));
	}

	return [
		`const sources = ${JSON.stringify(Object.fromEntries(registrations))};`,
		`const grammarNames = ${JSON.stringify(grammarNames)};`,
		`const themeSources = ${JSON.stringify(themeSources)};`,
		'const parsed = new Map();',
		'let themes;',
		'function registration(name) {',
		'\tif (!parsed.has(name)) parsed.set(name, Object.freeze(JSON.parse(sources[name])));',
		'\treturn parsed.get(name);',
		'}',
		`export const BUNDLED_LANGUAGES = ${JSON.stringify(languages)};`,
		`export const BUNDLED_THEMES = ${JSON.stringify(themes)};`,
		'export function bundledGrammar(name) {',
		'\tconst order = grammarNames[name];',
		'\treturn order ? order.map(registration) : undefined;',
		'}',
		'export function bundledThemes() {',
		'\treturn (themes ??= themeSources.map((source) => Object.freeze(JSON.parse(source))));',
		'}',
		'export default { BUNDLED_LANGUAGES, BUNDLED_THEMES, bundledGrammar, bundledThemes };',
	].join('\n');
}

export function lazyBundled() {
	return {
		name: 'shiki-lazy-bundled',
		async load(id) {
			if (id !== bundledModule) return null;

			return generateLazyBundled(await readFile(bundledModule, 'utf8'));
		},
	};
}

export default lazyBundled;
