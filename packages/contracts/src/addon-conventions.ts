import {
	NATIVE_PLUGIN_CAPABILITIES,
	NATIVE_PLUGIN_PLATFORM_CAPABILITIES,
} from '@unbound-app/types/native';

export const ADDON_FOLDER_MAX_LENGTH = 48;
export const ADDON_NAME_MAX_LENGTH = 64;
export const ADDON_DESCRIPTION_MAX_LENGTH = 160;

/** The manifest fields the naming and capability conventions read, each still unvalidated. */
export type ConventionManifest = {
	id?: unknown;
	name?: unknown;
	description?: unknown;
	capabilities?: unknown;
	platforms?: unknown;
	platformCapabilities?: unknown;
};

const SUPPORTED_CAPABILITIES: readonly string[] = NATIVE_PLUGIN_CAPABILITIES;
const SUPPORTED_PLATFORMS = Object.keys(NATIVE_PLUGIN_PLATFORM_CAPABILITIES).sort();
const PLATFORM_CAPABILITIES: Record<string, readonly string[]> =
	NATIVE_PLUGIN_PLATFORM_CAPABILITIES;

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

	validateText(manifest.name, 'name', ADDON_NAME_MAX_LENGTH, errors);

	if (
		typeof manifest.name === 'string' &&
		manifest.name.trim() &&
		!DISPLAY_NAME_PATTERN.test(manifest.name) &&
		!BRAND_NAME_PATTERN.test(manifest.name)
	) {
		errors.push('name must use title-case words separated by spaces');
	}

	validateText(manifest.description, 'description', ADDON_DESCRIPTION_MAX_LENGTH, errors);

	if (typeof manifest.id !== 'string' || !ID_PATTERN.test(manifest.id)) {
		errors.push('id must use a lowercase namespace and kebab-case suffix');
	} else if (folder !== void 0 && !manifest.id.endsWith(`.${folder}`)) {
		errors.push(`id must end with .${folder}`);
	}

	return errors;
}

/**
 * @description Checks that an addon's `platforms`, `capabilities` and `platformCapabilities` name
 * supported values, and that each platform can provide every Capability declared for it.
 * @param manifest The addon's parsed manifest.
 * @returns Every problem found, empty when the declarations are consistent.
 */
export function validateAddonCapabilities(manifest: ConventionManifest): string[] {
	const errors: string[] = [];
	const platforms = validatePlatforms(manifest.platforms, errors);

	validateFlatCapabilities(manifest.capabilities, platforms, errors);
	validatePlatformCapabilities(
		manifest.platformCapabilities,
		platforms,
		manifest.platforms !== void 0,
		errors,
	);

	return errors;
}

// UNKNOWN: a manifest field read before any validation.
function validateText(value: unknown, label: string, maxLength: number, errors: string[]) {
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

function providingPlatforms(capability: string) {
	return SUPPORTED_PLATFORMS.filter((platform) =>
		PLATFORM_CAPABILITIES[platform]?.includes(capability),
	);
}

// UNKNOWN: a manifest field read before any validation.
function validatePlatforms(value: unknown, errors: string[]): string[] {
	if (value === void 0) {
		return SUPPORTED_PLATFORMS;
	}

	if (!Array.isArray(value)) {
		errors.push('platforms must be an array');

		return SUPPORTED_PLATFORMS;
	}

	if (value.length === 0) {
		errors.push('platforms must not be empty');
	}

	const seen: string[] = [];

	for (const platform of value) {
		if (typeof platform !== 'string' || !SUPPORTED_PLATFORMS.includes(platform)) {
			errors.push(`platforms contains an unsupported value: ${String(platform)}`);

			continue;
		}

		if (seen.includes(platform)) {
			errors.push(`platforms must not repeat ${platform}`);

			continue;
		}

		seen.push(platform);
	}

	return seen.length > 0 ? seen.sort() : SUPPORTED_PLATFORMS;
}

// UNKNOWN: a manifest field read before any validation.
function validateFlatCapabilities(value: unknown, platforms: string[], errors: string[]) {
	if (value === void 0) return;

	if (!Array.isArray(value)) {
		errors.push('capabilities must be an array');

		return;
	}

	for (const capability of value) {
		if (typeof capability !== 'string' || !SUPPORTED_CAPABILITIES.includes(capability)) {
			errors.push(`capabilities contains an unsupported value: ${String(capability)}`);

			continue;
		}

		const missing = platforms.filter(
			(platform) => !PLATFORM_CAPABILITIES[platform]?.includes(capability),
		);

		if (missing.length === 0) {
			continue;
		}

		const providers = providingPlatforms(capability);
		const suggestion = providers.length
			? `; declare it under ${providers.map((platform) => `platformCapabilities.${platform}`).join(' and ')}`
			: '';

		errors.push(
			`capabilities contains ${capability}, which ${missing.join(', ')} cannot provide${suggestion}`,
		);
	}
}

// UNKNOWN: a manifest field read before any validation.
function validatePlatformCapabilities(
	value: unknown,
	platforms: string[],
	declaredPlatforms: boolean,
	errors: string[],
) {
	if (value === void 0) return;

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		errors.push('platformCapabilities must be an object');

		return;
	}

	for (const [platform, requirements] of Object.entries(value)) {
		if (!SUPPORTED_PLATFORMS.includes(platform)) {
			errors.push(`platformCapabilities contains an unsupported platform: ${platform}`);

			continue;
		}

		if (declaredPlatforms && !platforms.includes(platform)) {
			errors.push(`platformCapabilities declares ${platform}, which is not in platforms`);

			continue;
		}

		if (!Array.isArray(requirements)) {
			errors.push(`platformCapabilities.${platform} must be an array`);

			continue;
		}

		for (const capability of requirements) {
			if (typeof capability !== 'string' || !SUPPORTED_CAPABILITIES.includes(capability)) {
				errors.push(
					`platformCapabilities.${platform} contains an unsupported value: ${String(capability)}`,
				);

				continue;
			}

			if (!PLATFORM_CAPABILITIES[platform]?.includes(capability)) {
				errors.push(`platformCapabilities.${platform} cannot provide ${capability}`);
			}
		}
	}
}

export default {
	ADDON_FOLDER_MAX_LENGTH,
	ADDON_NAME_MAX_LENGTH,
	ADDON_DESCRIPTION_MAX_LENGTH,
	validateAddonFolder,
	validateAddonNaming,
	validateAddonCapabilities,
};
