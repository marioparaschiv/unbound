export const ADDON_FOLDER_MAX_LENGTH = 48;
export const ADDON_NAME_MAX_LENGTH = 64;
export const ADDON_DESCRIPTION_MAX_LENGTH = 160;

/** The manifest fields the naming conventions read, each still unvalidated. */
export type ConventionManifest = {
	id?: unknown;
	name?: unknown;
	description?: unknown;
};

const FOLDER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_PATTERN = /^[a-z][a-z0-9-]*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DISPLAY_NAME_PATTERN =
	/^(?:[A-Z][a-z0-9]*|[A-Z]{2,}[a-z]?)(?: (?:[A-Z][a-z0-9]*|[A-Z]{2,}[a-z]?))*$/;
const BRAND_NAME_PATTERN = /^[A-Z][a-z0-9]+[A-Z]{2,}$/;

/**
 * @description Checks an addon's folder name against the naming conventions.
 * @param folder The addon's folder name.
 * @returns Every problem found, empty when the folder follows the conventions.
 */
export function validateAddonFolder(folder: string): string[] {
	const errors: string[] = [];

	if (folder.length > ADDON_FOLDER_MAX_LENGTH) {
		errors.push(`folder must be at most ${ADDON_FOLDER_MAX_LENGTH} characters`);
	}

	if (!FOLDER_PATTERN.test(folder)) {
		errors.push('folder must use lowercase kebab-case');
	}

	return errors;
}

/**
 * @description Checks an addon's folder, id, display name and description against the naming conventions.
 * @param manifest The addon's parsed manifest.
 * @param folder The addon's folder name; omit it when the folder is not the author's choice, such as a bare repository.
 * @returns Every problem found, empty when the addon follows the conventions.
 */
export function validateAddonNaming(manifest: ConventionManifest, folder?: string): string[] {
	const errors = folder === void 0 ? [] : validateAddonFolder(folder);

	validateText(manifest, 'name', ADDON_NAME_MAX_LENGTH, errors);

	if (
		typeof manifest.name === 'string' &&
		manifest.name.trim() &&
		!DISPLAY_NAME_PATTERN.test(manifest.name) &&
		!BRAND_NAME_PATTERN.test(manifest.name)
	) {
		errors.push('name must use title-case words separated by spaces');
	}

	validateText(manifest, 'description', ADDON_DESCRIPTION_MAX_LENGTH, errors);

	if (typeof manifest.id !== 'string' || !ID_PATTERN.test(manifest.id)) {
		errors.push('id must use a lowercase namespace and kebab-case suffix');
	} else if (folder !== void 0 && !manifest.id.endsWith(`.${folder}`)) {
		errors.push(`id must end with .${folder}`);
	}

	return errors;
}

function validateText(
	manifest: ConventionManifest,
	label: 'name' | 'description',
	maxLength: number,
	errors: string[],
) {
	const value = manifest[label];

	if (typeof value !== 'string' || !value.trim()) {
		errors.push(`${label} must be a non-empty string`);

		return;
	}

	if (value.length > maxLength) {
		errors.push(`${label} must be at most ${maxLength} characters`);
	}

	if (value.trim() !== value) {
		errors.push(`${label} must not have leading or trailing whitespace`);
	}

	if (hasControlCharacter(value)) {
		errors.push(`${label} must not contain control characters`);
	}
}

function hasControlCharacter(value: string) {
	for (let i = 0, len = value.length; i < len; i++) {
		const code = value.charCodeAt(i);

		if (code < 0x20 || code === 0x7f) {
			return true;
		}
	}

	return false;
}

export default {
	ADDON_FOLDER_MAX_LENGTH,
	ADDON_NAME_MAX_LENGTH,
	ADDON_DESCRIPTION_MAX_LENGTH,
	validateAddonFolder,
	validateAddonNaming,
};
