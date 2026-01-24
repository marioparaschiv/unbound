import { existsSync, writeFileSync } from 'fs';
import Logger from '@unbound-app/logger';
import { execSync } from 'child_process';
import type { Plugin } from 'rolldown';
import { resolve } from 'path';

const logger = Logger.create('Build', 'Manifest');
const root = resolve(__dirname, '..', '..', '..');

function getBytecodeVersion(bundlePath: string): number | null {
	if (!existsSync(bundlePath)) return null;

	try {
		const output = execSync(`file "${bundlePath}"`).toString();
		const [, version] = output.match(/version (\d+)/) ?? [];
		return version ? parseInt(version, 10) : null;
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
