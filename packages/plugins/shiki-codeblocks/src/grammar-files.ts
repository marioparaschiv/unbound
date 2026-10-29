import type { LanguageRegistration } from 'shiki';
import { fs } from '@unbound-app/api';

import { SHIKI_LANGS_VERSION } from '~/constants';
import { grammarOrder } from '~/bundled';

export type RegistrationSource = (name: string) => Promise<LanguageRegistration>;

const CACHE_DIRECTORY = `Unbound/Cache/shiki-codeblocks/langs-${SHIKI_LANGS_VERSION}`;

/**
 * @description Builds the CDN URL of a bundled language's module, pinned to the Shiki version the plugin was built with.
 * @param name The registration's name.
 * @returns The module URL.
 */
export function grammarModuleUrl(name: string): string {
	return `https://cdn.jsdelivr.net/npm/@shikijs/langs@${SHIKI_LANGS_VERSION}/dist/${encodeURIComponent(name)}.mjs`;
}

/**
 * @description Reads the registration a `@shikijs/langs` module declares, without evaluating the module.
 * @param source The module's source.
 * @returns The language registration.
 */
export function registrationFromModule(source: string): LanguageRegistration {
	const literal = source.match(/JSON\.parse\(("(?:[^"\\]|\\.)*")\)/)?.[1];

	if (!literal) {
		throw new Error('The language module declares no registration.');
	}

	return JSON.parse(JSON.parse(literal));
}

async function readCached(path: string): Promise<LanguageRegistration | undefined> {
	try {
		return (await fs.exists(path)) ? JSON.parse(await fs.read(path)) : undefined;
	} catch {
		return undefined;
	}
}

async function download(name: string): Promise<LanguageRegistration> {
	const response = await fetch(grammarModuleUrl(name));

	if (!response.ok) {
		throw new Error(`Grammar ${name} returned ${response.status}`);
	}

	return registrationFromModule(await response.text());
}

/**
 * @description Loads a registration from the plugin's grammar files, downloading and saving it on first use.
 * @param name The registration's name.
 * @returns The language registration.
 */
export async function cachedRegistration(name: string): Promise<LanguageRegistration> {
	const path = `${CACHE_DIRECTORY}/${name}.json`;
	const cached = await readCached(path);

	if (cached) return cached;

	const registration = await download(name);

	await fs.write(path, JSON.stringify(registration)).catch(() => undefined);

	return registration;
}

/**
 * @description Loads a bundled language with the languages it embeds.
 * @param name The language name or alias.
 * @param source Where each registration comes from.
 * @returns The registrations, embedded languages first, or `undefined` when the language isn't bundled.
 */
export async function loadBundledGrammar(
	name: string,
	source: RegistrationSource = cachedRegistration,
): Promise<LanguageRegistration[] | undefined> {
	const order = grammarOrder(name);

	return order ? Promise.all(order.map((registration) => source(registration))) : undefined;
}

export default { cachedRegistration, grammarModuleUrl, loadBundledGrammar, registrationFromModule };
