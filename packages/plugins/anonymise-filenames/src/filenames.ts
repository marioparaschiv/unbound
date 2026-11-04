import {
	MAX_RANDOM_LENGTH,
	METHODS,
	MIN_RANDOM_LENGTH,
	RANDOM_CHARACTERS,
	SETTINGS,
	TAR_EXTENSION,
	type Method,
	type Settings,
} from '~/constants';

export type NameSources = {
	random: () => number;
	now: () => number;
};

const DEFAULT_SOURCES: NameSources = { random: Math.random, now: Date.now };

/**
 * @description Reads a stored anonymising method, falling back to random characters for anything unknown.
 * @param value The stored value.
 * @returns A known method.
 */
export function toMethod(value: unknown): Method {
	return METHODS.includes(value as Method) ? (value as Method) : SETTINGS.method;
}

/**
 * @description Reads a stored random name length as a whole number within the slider's range.
 * @param value The stored value.
 * @returns The length to use.
 */
export function toRandomLength(value: unknown): number {
	const length = Math.round(Number(value));

	if (!Number.isFinite(length)) return SETTINGS.randomisedLength;

	return Math.min(MAX_RANDOM_LENGTH, Math.max(MIN_RANDOM_LENGTH, length));
}

/**
 * @description Reads the stored fixed name, falling back to the default when it is blank.
 * @param value The stored value.
 * @returns The name to use, without an extension.
 */
export function toConsistentName(value: unknown): string {
	const name = typeof value === 'string' ? value.trim() : '';

	return name || SETTINGS.consistent;
}

/**
 * @description Reads every setting the renaming uses from a store, normalising each value.
 * @param read Reads one stored value, given its default.
 * @returns The settings to rename with.
 */
export function readSettings(
	read: <K extends keyof Settings>(key: K, fallback: Settings[K]) => unknown,
): Settings {
	return {
		anonymiseByDefault: read('anonymiseByDefault', SETTINGS.anonymiseByDefault) !== false,
		method: toMethod(read('method', SETTINGS.method)),
		randomisedLength: toRandomLength(read('randomisedLength', SETTINGS.randomisedLength)),
		consistent: toConsistentName(read('consistent', SETTINGS.consistent)),
	};
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
			return settings.consistent + extension;
		case 'timestamp':
			return String(sources.now()) + extension;
		default:
			return randomName(settings.randomisedLength, sources.random) + extension;
	}
}
