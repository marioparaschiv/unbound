import { existsSync, writeFileSync } from 'fs';
import Logger from '@unbound-app/logger';
import { execSync } from 'child_process';
import type { Plugin } from 'rolldown';
import { resolve } from 'path';

const logger = Logger.create('Build', 'Manifest');

export default function generateManifest(revision: string): Plugin {
	return {
		name: 'generate-manifest',
		writeBundle() {
			const bundlePath = resolve('dist/unbound.bundle');
			const manifestPath = resolve('dist/manifest.json');

			let bytecodeVersion: number | null = null;

			if (existsSync(bundlePath)) {
				try {
					const fileOutput = execSync(`file "${bundlePath}"`).toString();
					const versionMatch = fileOutput.match(/version (\d+)/);

					if (versionMatch) {
						bytecodeVersion = parseInt(versionMatch[1], 10);
					}
				} catch (error) {
					logger.warn(
						'Failed to detect bytecode version:',
						error instanceof Error ? error.message : String(error),
					);
				}
			}

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
