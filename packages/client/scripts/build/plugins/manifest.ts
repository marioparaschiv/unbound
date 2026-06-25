import { existsSync, readFileSync, writeFileSync } from 'fs';
import Logger from '@unbound-app/logger';
import type { Plugin } from 'rolldown';
import { resolve } from 'path';

const logger = Logger.create('Build', 'Manifest');
const root = resolve(__dirname, '..', '..', '..');

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

export default function generateManifest(revision: string): Plugin {
	return {
		name: 'generate-manifest',
		writeBundle() {
			const bundlePath = resolve(root, 'dist/unbound.bundle');
			const manifestPath = resolve(root, 'dist/manifest.json');
			const bytecodeVersion = getBytecodeVersion(bundlePath);

			const manifest = {
				revision,
				buildTime: new Date().toISOString(),
				bytecodeVersion,
			};

			writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
			logger.success('Generated manifest.json with bytecode version', bytecodeVersion);
		},
	};
}
