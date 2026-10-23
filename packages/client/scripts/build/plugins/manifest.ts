import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import Logger from '@unbound-app/logger';
import type { Plugin } from 'rolldown';
import { resolve } from 'node:path';

const logger = Logger.create('Build', 'Manifest');
const root = resolve(__dirname, '..', '..', '..');
const dist = resolve(root, 'dist');

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
		if (!file.startsWith('unbound.') || !file.endsWith('.bundle')) {
			continue;
		}

		const version = getBytecodeVersion(resolve(dist, file));

		if (version !== null) {
			versions.push(version);
		}
	}

	return [...new Set(versions)].sort((a, b) => b - a);
}

/**
 * @description Writes `manifest.json` next to the bundles, listing the revision and bytecode versions.
 * @param revision The git revision the bundle was built from.
 * @returns A rolldown plugin writing the manifest after the bundle.
 */
export default function generateManifest(revision: string): Plugin {
	return {
		name: 'generate-manifest',
		writeBundle() {
			const manifestPath = resolve(dist, 'manifest.json');
			const bytecodeVersions = getBytecodeVersions();

			const manifest = {
				revision,
				buildTime: new Date().toISOString(),
				bytecodeVersions,
			};

			writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
			logger.success(
				'Generated manifest.json with bytecode versions',
				bytecodeVersions.join(', '),
			);
		},
	};
}
