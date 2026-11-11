import type { Settings } from '@unbound-app/settings';

import { DEFAULT_FILE_NAME, RANDOM_CHARACTERS, TAR_EXTENSION } from '~/lib/constants';

export type NameSources = {
	random: () => number;
	now: () => number;
};

const DEFAULT_SOURCES: NameSources = { random: Math.random, now: Date.now };

/**
 * @description Reads the stored fixed name, falling back to the default when it is blank.
 * @param value The stored value.
 * @returns The name to use, without an extension.
 */
export function toConsistentName(value: string): string {
	return value.trim() || DEFAULT_FILE_NAME;
}

/**
 * @description Finds a file name's extension, keeping both parts of compressed tarballs such as `.tar.gz`.
 * @param filename The original file name.
 * @returns The extension with its leading dot, or an empty string when there is none.
 */
export function fileExtension(filename: string): string {
	const index = TAR_EXTENSION.exec(filename)?.index ?? filename.lastIndexOf('.');

	return index === -1 ? '' : filename.slice(index);
}

function randomName(length: number, random: () => number): string {
	return Array.from(
		{ length },
		() => RANDOM_CHARACTERS[Math.floor(random() * RANDOM_CHARACTERS.length)],
	).join('');
}

/**
 * @description Builds the anonymous name for a file, keeping its extension.
 * @param filename The original file name.
 * @param settings The method and its options.
 * @param sources The random number and clock sources, replaceable in tests.
 * @returns The new file name.
 */
export function anonymiseFilename(
	filename: string,
	settings: Pick<Settings, 'method' | 'randomisedLength' | 'consistent'>,
	sources: NameSources = DEFAULT_SOURCES,
): string {
	const extension = fileExtension(filename);

	switch (settings.method) {
		case 'consistent':
			return toConsistentName(settings.consistent) + extension;
		case 'timestamp':
			return String(sources.now()) + extension;
		default:
			return randomName(settings.randomisedLength, sources.random) + extension;
	}
}
