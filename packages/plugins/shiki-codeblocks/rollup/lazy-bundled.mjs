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
	const grammarNames = {};

	for (const key of languages) {
		const grammar = (await import(`@shikijs/langs/${key}`)).default;
		const order = grammar.map((language) => language.name);

		for (const language of grammar) {
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
		`const grammarNames = ${JSON.stringify(grammarNames)};`,
		`const themeSources = ${JSON.stringify(themeSources)};`,
		'let themes;',
		`export const BUNDLED_LANGUAGES = ${JSON.stringify(languages)};`,
		`export const BUNDLED_THEMES = ${JSON.stringify(themes)};`,
		'export function grammarOrder(name) {',
		'\treturn Object.prototype.hasOwnProperty.call(grammarNames, name) ? grammarNames[name] : undefined;',
		'}',
		'export function bundledThemes() {',
		'\treturn (themes ??= themeSources.map((source) => Object.freeze(JSON.parse(source))));',
		'}',
		'export default { BUNDLED_LANGUAGES, BUNDLED_THEMES, grammarOrder, bundledThemes };',
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
