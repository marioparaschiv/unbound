import { resolveSpecText } from '~/permissions/spec-text';
import { fallbackTitle, type PermissionBit } from '~/permissions/model';
import { i18n, PermissionSpecs } from '~/discord/modules';
import type { Guild, PermissionSpec } from '~/types';

export type PermissionText = {
	title: (permission: PermissionBit) => string;
	description: (permission: PermissionBit) => string | undefined;
};

function formatMessage(message: unknown): string | undefined {
	try {
		const text = i18n.intl?.formatToPlainString?.(message, {});

		return typeof text === 'string' ? text : undefined;
	} catch {
		return undefined;
	}
}

function loadSpecMap(guild: Guild): Record<string, PermissionSpec> {
	try {
		return PermissionSpecs.getGuildPermissionSpecMap?.(guild) ?? {};
	} catch {
		return {};
	}
}

/**
 * @description Names and describes permissions with Discord's own permission spec for a server, falling back to built-in titles when the spec is missing.
 * @param guild The server, whose features change some titles.
 * @returns Functions that title and describe a permission.
 */
export function createPermissionText(guild: Guild): PermissionText {
	const specs = loadSpecMap(guild);

	return {
		title: (permission) =>
			resolveSpecText(specs[String(permission.bit)]?.title, formatMessage) ??
			fallbackTitle(permission.name),
		description: (permission) =>
			resolveSpecText(specs[String(permission.bit)]?.description, formatMessage),
	};
}
