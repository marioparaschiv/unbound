import { MANIFEST_FILENAME, validateAddonCapabilities } from '@unbound-app/contracts/manifest';
import type { NativePluginCapability, NativePluginPlatform } from '@unbound-app/types/native';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { NATIVE_PLUGIN_PLATFORMS } from '@unbound-app/types/native';
import { getBundleName } from '@unbound-app/contracts/workspace';
import { join } from 'node:path';

import type { PlatformCapabilities } from '~/lib/capabilities/analyze';
import { analyzeCapabilities } from '~/lib/capabilities/analyze';
import type { Check, CheckContext } from '~/lib/check/check';
import type { DiscoveredAddon } from '~/lib/discovery';
import type { Diagnostic } from '~/rollup/diagnostic';
import { readDevManifest } from '~/lib/manifest';
import { diagnostic } from '~/rollup/diagnostic';
import { findFile } from '~/rollup/source-alias';

type DevManifest = ReturnType<typeof readDevManifest>;

type GeneratedPlatform = { capabilities?: NativePluginCapability[] };

type GeneratedPlatforms = Partial<Record<NativePluginPlatform, GeneratedPlatform>>;

const GENERATED_FIELDS = ['capabilities', 'platforms'] as const;

function manifestError(message: string, path?: string, fix?: string): Diagnostic {
	return diagnostic({ file: MANIFEST_FILENAME, path, severity: 'error', message, fix });
}

function findEntry(dir: string, main: string): string | null {
	return findFile(join(dir, 'src', 'index')) ?? findFile(join(dir, main));
}

function toPlatformsField(platforms: PlatformCapabilities): GeneratedPlatforms | undefined {
	const listed = NATIVE_PLUGIN_PLATFORMS.filter((platform) => platforms[platform]);
	const needsCapabilities = listed.some((platform) => platforms[platform]?.length);

	if (listed.length === NATIVE_PLUGIN_PLATFORMS.length && !needsCapabilities) {
		return void 0;
	}

	const generated: GeneratedPlatforms = {};

	for (const platform of listed) {
		const capabilities = platforms[platform] ?? [];

		generated[platform] = capabilities.length ? { capabilities } : {};
	}

	return generated;
}

function writeBuiltManifest(
	addon: DiscoveredAddon,
	manifest: DevManifest,
	generated: PlatformCapabilities,
) {
	const target = join(addon.output, MANIFEST_FILENAME);
	const temporary = `${target}.tmp`;
	const built = existsSync(target)
		? readDevManifest(addon.output)
		: { ...manifest, main: getBundleName(false, manifest.main) };
	const { capabilities, platforms, ...rest } = built;

	mkdirSync(addon.output, { recursive: true });
	writeFileSync(
		temporary,
		`${JSON.stringify({ ...rest, id: manifest.id, platforms: toPlatformsField(generated) }, null, '\t')}\n`,
	);
	renameSync(temporary, target);
}

export const capabilitiesCheck: Check = {
	id: 'capabilities',
	/**
	 * @description Generates a built plugin's platforms and Capabilities from its code, into
	 * `{output}/manifest.json` when the context emits.
	 * @param context The addon to check.
	 * @returns One error per hand-written field, dynamic or misplaced bridge access, or undeclarable Capability.
	 */
	run(context) {
		return checkCapabilities(context, false);
	},
};

export const declaredCapabilitiesCheck: Check = {
	id: 'capabilities',
	/**
	 * @description Like the capabilities check, but a plugin that still hand-writes its platforms and
	 * Capabilities keeps them, checked against what each platform provides, instead of failing.
	 * @param context The addon to check.
	 * @returns One error per problem in the hand-written fields, or what the capabilities check returns.
	 */
	run(context) {
		return checkCapabilities(context, true);
	},
};

function checkCapabilities(
	{ addon, emit, cache }: CheckContext,
	acceptDeclared: boolean,
): Diagnostic[] {
	const manifest = readDevManifest(addon.dir);
	const declared = GENERATED_FIELDS.filter((field) => manifest[field] !== void 0);

	if (addon.static || addon.kind !== 'plugin' || (acceptDeclared && declared.length)) {
		return validateAddonCapabilities(manifest).map(({ path, message }) =>
			manifestError(message, path || void 0),
		);
	}

	const issues = declared.map((field) =>
		manifestError(
			`Declares "${field}", which ubd build generates from the code`,
			field,
			'remove it',
		),
	);
	const entry = findEntry(addon.dir, manifest.main);

	if (!entry) {
		return [
			...issues,
			manifestError(
				`Found neither src/index nor ${manifest.main} to read the native calls from.`,
			),
		];
	}

	const analysis = analyzeCapabilities(addon.dir, entry, cache.typescript);

	issues.push(
		...analysis.errors.map(({ site, message }) =>
			diagnostic({ ...site, severity: 'error', message }),
		),
	);

	if (emit && !issues.length) {
		writeBuiltManifest(addon, manifest, analysis.platforms);
	}

	return issues;
}

export default { capabilitiesCheck, declaredCapabilitiesCheck };
