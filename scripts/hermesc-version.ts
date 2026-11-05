import { appendFileSync, readFileSync } from 'node:fs';

export type HermescRelease = { shouldBuild: boolean; packageVersion: string };

/**
 * @description Decides whether the hermesc workflow builds, and the npm version it publishes: `<bytecode>.0.0` unless overridden.
 * @param bytecodeVersion The `BYTECODE_VERSION` upstream Hermes declares.
 * @param publishedVersions The versions of `@unbound-app/hermesc` already on npm.
 * @param versionOverride An explicit npm version from the manual dispatch.
 * @returns Whether to build, and the version to publish.
 */
export function decideHermescRelease(
	bytecodeVersion: string,
	publishedVersions: string[],
	versionOverride = '',
): HermescRelease {
	const bytecode = bytecodeVersion.trim();

	if (!/^[0-9]+$/.test(bytecode)) {
		throw new Error(
			`Invalid bytecode version ${JSON.stringify(bytecodeVersion)}, expected an integer.`,
		);
	}

	const packageVersion = versionOverride || `${bytecode}.0.0`;

	return { shouldBuild: !publishedVersions.includes(packageVersion), packageVersion };
}

/**
 * @description Parses `npm view <package> versions --json`, which prints an array, a bare string for one version, or nothing when unpublished.
 * @param raw The command's output.
 * @returns The published versions.
 */
export function parsePublishedVersions(raw: string): string[] {
	const text = raw.trim();

	if (!text) {
		return [];
	}

	const parsed: unknown = JSON.parse(text);
	const versions = Array.isArray(parsed) ? parsed : [parsed];

	return versions.filter((version): version is string => typeof version === 'string');
}

if (import.meta.main) {
	const bytecode = process.env.BYTECODE_VERSION ?? '';
	const { shouldBuild, packageVersion } = decideHermescRelease(
		bytecode,
		parsePublishedVersions(readFileSync(0, 'utf-8')),
		process.env.VERSION_OVERRIDE,
	);

	appendFileSync(
		process.env.GITHUB_OUTPUT ?? '/dev/stdout',
		`bytecode_version=${bytecode.trim()}\npackage_version=${packageVersion}\nshould_build=${shouldBuild}\n`,
	);
}
