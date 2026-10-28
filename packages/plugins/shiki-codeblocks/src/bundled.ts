import type { LanguageRegistration, ThemeRegistration } from 'shiki';
import typescript from '@shikijs/langs/typescript';
import javascript from '@shikijs/langs/javascript';
import lightPlus from '@shikijs/themes/light-plus';
import darkPlus from '@shikijs/themes/dark-plus';
import markdown from '@shikijs/langs/markdown';
import python from '@shikijs/langs/python';
import kotlin from '@shikijs/langs/kotlin';
import swift from '@shikijs/langs/swift';
import jsonc from '@shikijs/langs/jsonc';
import java from '@shikijs/langs/java';
import html from '@shikijs/langs/html';
import rust from '@shikijs/langs/rust';
import yaml from '@shikijs/langs/yaml';
import bash from '@shikijs/langs/bash';
import json from '@shikijs/langs/json';
import css from '@shikijs/langs/css';
import cpp from '@shikijs/langs/cpp';
import sql from '@shikijs/langs/sql';
import tsx from '@shikijs/langs/tsx';
import go from '@shikijs/langs/go';
import c from '@shikijs/langs/c';

export const BUNDLED_LANGUAGES = [
	'bash',
	'c',
	'cpp',
	'css',
	'go',
	'html',
	'java',
	'javascript',
	'json',
	'jsonc',
	'kotlin',
	'markdown',
	'python',
	'rust',
	'sql',
	'swift',
	'tsx',
	'typescript',
	'yaml',
] as const;

export const BUNDLED_THEMES = ['dark-plus', 'light-plus'] as const;

const grammars: Record<(typeof BUNDLED_LANGUAGES)[number], LanguageRegistration[]> = {
	bash,
	c,
	cpp,
	css,
	go,
	html,
	java,
	javascript,
	json,
	jsonc,
	kotlin,
	markdown,
	python,
	rust,
	sql,
	swift,
	tsx,
	typescript,
	yaml,
};

const grammarByName = new Map<string, LanguageRegistration[]>();

for (const grammar of Object.values(grammars)) {
	for (const language of grammar) {
		for (const name of [language.name, ...(language.aliases ?? [])]) {
			grammarByName.set(name, grammar);
		}
	}
}

/**
 * @description Looks up a grammar bundled with the plugin by language name or alias.
 * @param name The language name or alias.
 * @returns The grammar's registrations, embedded languages first, or `undefined` when it isn't bundled.
 */
export function bundledGrammar(name: string): LanguageRegistration[] | undefined {
	return grammarByName.get(name);
}

/**
 * @description Returns the themes bundled with the plugin.
 * @returns Dark+ and Light+.
 */
export function bundledThemes(): ThemeRegistration[] {
	return [darkPlus, lightPlus];
}

export default { BUNDLED_LANGUAGES, BUNDLED_THEMES, bundledGrammar, bundledThemes };
