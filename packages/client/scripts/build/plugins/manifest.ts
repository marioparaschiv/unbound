import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import Logger from '@unbound-app/logger';
import type { Plugin } from 'rolldown';
import { resolve } from 'node:path';

import { BUNDLE_PATTERN, bundleHashes } from '../sign';

const logger = Logger.create('Build', 'Manifest');
const root = resolve(__dirname, '..', '..', '..');
const dist = resolve(root, 'dist');
const nativeBridgeVersionHeader = resolve(
	root,
	'..',
	'loader',
	'core',
	'include',
	'NativePluginVersion.h',
);

// Hermes bytecode (HBC) file header: an 8-byte magic followed by a uint32
// version, both little-endian.
const HBC_MAGIC = 0x1f1903c103bc1fc6n;

function getBytecodeVersion(bundlePath: string): number | null {
	if (!existsSync(bundlePath)) {
		return null;
	}

	try {
		const header = readFileSync(bundlePath).subarray(0, 12);

		if (header.length < 12 || header.readBigUInt64LE(0) !== HBC_MAGIC) {
			return null;
		}

		return header.readUInt32LE(8);
	} catch (error) {
		logger.warn(
			'Failed to detect bytecode version:',
			error instanceof Error ? error.message : String(error),
		);

		return null;
	}
}

function getBytecodeVersions(): number[] {
	if (!existsSync(dist)) {
		return [];
	}

	const versions: number[] = [];

	for (const file of readdirSync(dist)) {
		if (!BUNDLE_PATTERN.test(file)) {
			continue;
		}

		const version = getBytecodeVersion(resolve(dist, file));

		if (version !== null) {
			versions.push(version);
		}
	}

	return [...new Set(versions)].sort((a, b) => b - a);
}

/** The native bridge versions a bundle is built against. */
export type NativeBridgeVersion = {
	api: string;
	abi: string;
};

/**
 * @description Reads the native bridge API and ABI versions the loader declares in `NativePluginVersion.h`.
 * @param header The header's source text.
 * @returns The bridge versions the bundle is built against.
 */
export function parseNativeBridgeVersion(header: string): NativeBridgeVersion {
	function read(name: string): string {
		const match = header.match(new RegExp(`${name}\\[\\]\\s*=\\s*"(\\d+\\.\\d+\\.\\d+)"`));

		if (!match?.[1]) {
			throw new Error(`NativePluginVersion.h does not declare ${name}.`);
		}

		return match[1];
	}

	return { api: read('kNativePluginApiVersion'), abi: read('kNativePluginAbiVersion') };
}

/**
 * @description Describes how the bytecode versions a build produced differ from the ones `hermes.json` declares.
 * @param declared The bytecode versions `hermes.json` declares.
 * @param built The bytecode versions the build produced.
 * @returns The mismatch, or `null` when both list the same versions.
 */
export function describeBytecodeMismatch(declared: number[], built: number[]): string | null {
	const missing = declared.filter((version) => !built.includes(version));
	const unexpected = built.filter((version) => !declared.includes(version));

	if (missing.length === 0 && unexpected.length === 0) {
		return null;
	}

	const problems = [
		missing.length > 0 && `is missing ${missing.join(', ')}`,
		unexpected.length > 0 && `also produced ${unexpected.join(', ')}`,
	].filter(Boolean);

	return `hermes.json declares bytecode ${declared.join(', ')}, but the build ${problems.join(' and ')}. Update hermes.json so the compatibility scan checks what ships.`;
}

/** What {@link writeManifest} records beside the bundles. */
export type ManifestOptions = {
	/** The git revision the bundles were built from. */
	revision: string;
	/** The bytecode versions `hermes.json` declares. */
	declared: number[];
	/** Whether a mismatch with `declared` only warns instead of failing the build. */
	lenient: boolean;
	/** The channel the build is published to. */
	channel: string;
	/** The oldest loader that runs the bundles. */
	minLoaderVersion: string;
};

/**
 * @description Writes `manifest.json` next to the bundles, listing the revision, channel, build time,
 * bytecode versions, oldest loader that runs them and each bundle's SHA-512.
 * @param options The build's revision, declared bytecode versions, leniency, channel and minimum loader.
 * @returns Why the manifest was not written, or `null` once it is.
 */
export function writeManifest(options: ManifestOptions): string | null {
	const manifestPath = resolve(dist, 'manifest.json');
	const bytecodeVersions = getBytecodeVersions();
	const mismatch = describeBytecodeMismatch(options.declared, bytecodeVersions);

	if (mismatch) {
		logger.warn(mismatch);

		// A release that ships a version `hermes.json` leaves out fails before the manifest is written.
		if (!options.lenient) {
			return mismatch;
		}
	}

	const manifest = {
		revision: options.revision,
		channel: options.channel,
		buildTime: new Date().toISOString(),
		bytecodeVersions,
		nativeBridge: parseNativeBridgeVersion(readFileSync(nativeBridgeVersionHeader, 'utf8')),
		minLoaderVersion: options.minLoaderVersion,
		sha512: bundleHashes(dist),
	};

	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
	logger.success('Generated manifest.json with bytecode versions', bytecodeVersions.join(', '));

	return null;
}

/**
 * @description Writes `manifest.json` after every bundle, failing the build on a declared-version mismatch.
 * @param revision The git revision the bundle was built from.
 * @param declared The bytecode versions `hermes.json` declares.
 * @param lenient Whether a mismatch with `declared` only warns instead of failing the build.
 * @param channel The channel the build is published to.
 * @param minLoaderVersion The oldest loader that runs the bundles.
 * @returns A rolldown plugin writing the manifest after the bundle.
 */
export default function generateManifest(
	revision: string,
	declared: number[],
	lenient: boolean,
	channel: string,
	minLoaderVersion: string,
): Plugin {
	return {
		name: 'generate-manifest',
		writeBundle() {
			const problem = writeManifest({
				revision,
				declared,
				lenient,
				channel,
				minLoaderVersion,
			});

			if (problem) {
				this.error(problem);
			}
		},
	};
}
