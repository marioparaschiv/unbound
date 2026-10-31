import { validateAddonCapabilities } from '@unbound-app/contracts/addon-conventions';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { MANIFEST_FILENAME } from '@unbound-app/contracts/manifest';
import { getBundleName } from '@unbound-app/contracts/workspace';
import { join } from 'node:path';

import type { PlatformCapabilities } from '~/lib/capabilities/analyze';
import type { BuildCheck, BuildCheckIssue } from '~/lib/build-checks';
import { analyzeCapabilities } from '~/lib/capabilities/analyze';
import type { DiscoveredAddon } from '~/lib/discovery';
import { readDevManifest } from '~/lib/manifest';
import { findFile } from '~/rollup/source-alias';

type DevManifest = ReturnType<typeof readDevManifest>;

const GENERATED_FIELDS = ['capabilities', 'platforms', 'platformCapabilities'] as const;

function error(message: string): BuildCheckIssue {
	return { severity: 'error', message };
}

function findEntry(dir: string, main: string): string | null {
	return findFile(join(dir, 'src', 'index')) ?? findFile(join(dir, main));
}

function writeBuiltManifest(
	addon: DiscoveredAddon,
	manifest: DevManifest,
	platforms: PlatformCapabilities,
) {
	const target = join(addon.output, MANIFEST_FILENAME);
	const temporary = `${target}.tmp`;
	const built = existsSync(target)
		? readDevManifest(addon.output)
		: { ...manifest, main: getBundleName(false, manifest.main) };
	const generated = Object.fromEntries(
		Object.entries(platforms).map(([platform, capabilities]) => [platform, { capabilities }]),
	);

	mkdirSync(addon.output, { recursive: true });
	writeFileSync(
		temporary,
		`${JSON.stringify({ ...built, id: manifest.id, platforms: generated }, null, '\t')}\n`,
	);
	renameSync(temporary, target);
}

export const capabilitiesCheck: BuildCheck = {
	name: 'capabilities',
	/**
	 * @description Generates a built plugin's platforms and Capabilities from its code into
	 * `{output}/manifest.json`. A static addon or a theme has no code to read, so its declared
	 * platforms and Capabilities are checked instead.
	 * @param addon The addon to check.
	 * @returns One error per hand-written field, dynamic or misplaced bridge access, or undeclarable Capability.
	 */
	run(addon) {
		const manifest = readDevManifest(addon.dir);

		if (addon.static || addon.kind !== 'plugin') {
			return validateAddonCapabilities(manifest).map(error);
		}

		const issues = GENERATED_FIELDS.filter((field) => manifest[field] !== void 0).map((field) =>
			error(
				`${MANIFEST_FILENAME} declares "${field}"; ubd build generates platforms and Capabilities from the code, so remove it.`,
			),
		);
		const entry = findEntry(addon.dir, manifest.main);

		if (!entry) {
			return [
				...issues,
				error(
					`Found neither src/index nor ${manifest.main} to read the native calls from.`,
				),
			];
		}

		const analysis = analyzeCapabilities(addon.dir, entry);

		issues.push(...analysis.errors.map(error));

		if (!issues.length) {
			writeBuiltManifest(addon, manifest, analysis.platforms);
		}

		return issues;
	},
};

export default capabilitiesCheck;
