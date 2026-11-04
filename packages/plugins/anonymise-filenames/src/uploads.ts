import { anonymiseFilename, fileExtension, type NameSources } from '~/filenames';
import type { Settings } from '~/constants';

export type Upload = {
	id?: unknown;
	filename?: unknown;
};

export type UploadChoices = {
	isAnonymised: (upload: Upload) => boolean;
	setAnonymised: (upload: Upload, anonymise: boolean) => void;
	apply: (upload: Upload) => void;
	clear: () => void;
};

/**
 * @description Tracks, per upload, whether its file name is anonymised, and renames or restores it to match.
 * An upload keeps its anonymous name once given one, so uploading and then sending it does not rename it twice, and it keeps its first original name even when Discord changes the name in between.
 * @param getSettings Reads the current settings.
 * @param sources The random number and clock sources, replaceable in tests.
 * @returns The per-upload choices.
 */
function stemOf(filename: string): string {
	return filename.slice(0, filename.length - fileExtension(filename).length);
}

function onlyExtensionChanged(current: string, renamed: string | undefined): boolean {
	return renamed !== undefined && current !== renamed && stemOf(current) === stemOf(renamed);
}

export function createUploadChoices(
	getSettings: () => Settings,
	sources?: NameSources,
): UploadChoices {
	const choices = new Map<string, boolean>();
	const originals = new WeakMap<object, string>();
	const renamed = new WeakMap<object, string>();

	function keyOf(upload: Upload): string | undefined {
		return typeof upload.id === 'string' || typeof upload.id === 'number'
			? String(upload.id)
			: undefined;
	}

	function isAnonymised(upload: Upload): boolean {
		const key = keyOf(upload);
		const choice = key === undefined ? undefined : choices.get(key);

		return choice ?? getSettings().anonymiseByDefault;
	}

	function setAnonymised(upload: Upload, anonymise: boolean) {
		const key = keyOf(upload);

		if (key !== undefined) choices.set(key, anonymise);
	}

	function restore(upload: Upload) {
		const original = originals.get(upload);
		const current = upload.filename;

		if (original !== undefined && typeof current === 'string') {
			if (
				current === renamed.get(upload) ||
				onlyExtensionChanged(current, renamed.get(upload))
			) {
				upload.filename = stemOf(original) + fileExtension(current);
			}
		}

		originals.delete(upload);
		renamed.delete(upload);
	}

	function anonymise(upload: Upload) {
		if (typeof upload.filename !== 'string') return;

		const current = upload.filename;

		if (current === renamed.get(upload)) return;

		if (onlyExtensionChanged(current, renamed.get(upload))) {
			renamed.set(upload, current);

			return;
		}

		const name = anonymiseFilename(current, getSettings(), sources);

		if (!originals.has(upload)) originals.set(upload, current);
		renamed.set(upload, name);
		upload.filename = name;
	}

	function apply(upload: Upload) {
		if (!upload || typeof upload !== 'object') return;

		if (isAnonymised(upload)) {
			anonymise(upload);
		} else {
			restore(upload);
		}
	}

	return { isAnonymised, setAnonymised, apply, clear: () => choices.clear() };
}

export default createUploadChoices;
