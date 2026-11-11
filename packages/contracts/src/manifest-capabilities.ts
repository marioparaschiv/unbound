import {
	NATIVE_BRIDGE_CAPABILITIES,
	NATIVE_BRIDGE_PLATFORM_CAPABILITIES,
	NATIVE_BRIDGE_PLATFORMS,
	type NativeBridgeCapability,
} from '@unbound-app/types/native';
import type { AddonPlatforms } from '@unbound-app/types/addons';

import { safeParse, superRefine, Type, type SchemaIssue } from './schema';

/** The manifest fields that name Capabilities; `ubd build` generates `platforms`, and `capabilities` is legacy (ADR 0003). */
export type CapabilityFields = {
	platforms?: AddonPlatforms;
	capabilities?: NativeBridgeCapability[];
};

const PLATFORMS: readonly string[] = NATIVE_BRIDGE_PLATFORMS;
const CAPABILITIES: readonly string[] = NATIVE_BRIDGE_CAPABILITIES;
const PROVIDED: Record<string, readonly string[]> = NATIVE_BRIDGE_PLATFORM_CAPABILITIES;

// The schemas check only the shape; `capabilityIssues` checks every name against the Capability table.
/** The legacy flat Capability list, needed on every platform the addon runs on. */
export const addonCapabilitiesSchema = Type.Unsafe<NativeBridgeCapability[]>(
	Type.Array(Type.String()),
);

/** The platforms an addon runs on, each with the Capabilities it needs there. */
export const addonPlatformsSchema = Type.Unsafe<AddonPlatforms>(
	Type.Record(
		Type.String(),
		Type.Object(
			{ capabilities: Type.Optional(addonCapabilitiesSchema) },
			{ additionalProperties: false },
		),
	),
);

/**
 * @description Checks that a manifest's `platforms` and `capabilities` name supported platforms and
 * Capabilities, and that every platform an addon runs on provides each Capability it needs there.
 * @param fields The manifest's `platforms` and `capabilities`, already shaped by their schemas.
 * @returns One issue per problem, at the offending value.
 */
export function capabilityIssues({ platforms, capabilities }: CapabilityFields): SchemaIssue[] {
	const issues: SchemaIssue[] = [];
	const listed = platforms ? Object.keys(platforms).filter((key) => PLATFORMS.includes(key)) : [];

	if (platforms) {
		issues.push(...platformIssues(platforms));
	}

	for (const [index, capability] of (capabilities ?? []).entries()) {
		issues.push(
			...nameIssues(`/capabilities/${index}`, capability, listed.length ? listed : PLATFORMS),
		);
	}

	return issues;
}

function platformIssues(platforms: AddonPlatforms): SchemaIssue[] {
	const entries = Object.entries(platforms);

	if (!entries.length) {
		return [{ path: '/platforms', message: 'Must list a platform.' }];
	}

	return entries.flatMap(([platform, entry]) => {
		if (!PLATFORMS.includes(platform)) {
			return [
				{
					path: `/platforms/${platform}`,
					message: `Must be a supported platform: ${PLATFORMS.join(' or ')}.`,
				},
			];
		}

		return (entry?.capabilities ?? []).flatMap((capability: string, index: number) =>
			nameIssues(`/platforms/${platform}/capabilities/${index}`, capability, [platform]),
		);
	});
}

function nameIssues(path: string, capability: string, platforms: readonly string[]): SchemaIssue[] {
	if (!CAPABILITIES.includes(capability)) {
		return [{ path, message: `Must be a Capability, not ${capability}.` }];
	}

	const missing = platforms.filter((platform) => !PROVIDED[platform]?.includes(capability));

	return missing.length
		? [{ path, message: `${missing.join(' and ')} cannot provide ${capability}.` }]
		: [];
}

const capabilityFieldsSchema = superRefine(
	Type.Object({
		platforms: Type.Optional(addonPlatformsSchema),
		capabilities: Type.Optional(addonCapabilitiesSchema),
	}),
	capabilityIssues,
);

/**
 * @description Validates a manifest's `platforms` and `capabilities` alone, by the rules the full
 * manifest schema applies, for a manifest that still declares them by hand.
 * @param manifest The parsed manifest.
 * @returns Every issue found, empty when both fields are valid or absent.
 */
// UNKNOWN: a parsed manifest.json, validated here.
export function validateAddonCapabilities(manifest: unknown): SchemaIssue[] {
	const result = safeParse(capabilityFieldsSchema, manifest);

	return result.success ? [] : result.error.issues;
}

export default {
	addonPlatformsSchema,
	addonCapabilitiesSchema,
	capabilityIssues,
	validateAddonCapabilities,
};
