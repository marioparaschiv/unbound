import Storage, { DCDFileManager } from '@api/storage';
import downloadFile from '@utilities/downloadFile';
import { ReactNative as RN } from '@metro/common';
import Manager, { ManagerType, isValidManager } from './base';
import { createPatcher } from '@patcher';
import { fastFindByProps } from '@metro';
import { ClientName, Regex } from '@constants';
import { chunkArray } from '@utilities';
import { Strings, add } from '@api/i18n';

import type { Addon, Manifest, Resolveable } from '@typings/managers';

type SourceManifest = Pick<Manifest, 'id' | 'name' | 'description' | 'icon'> & {
	iconType?: string;
	tags: string[];
	addons: (Pick<Manifest, 'name' | 'icon'> & {
		type: string;
		iconType?: string;
		screenshots: string[];
		changelog: string;
		manifest: string;
		readme: string;
	})[];
};

type Bundle = {
	manifest: Manifest;
	changelog: Record<string, string[]>;
	readme?: string;
	screenshots?: string[];
}[];

class Sources extends Manager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'json';
	public signal: AbortSignal;

	constructor() {
		super(ManagerType.Sources);

		this.patcher = createPatcher('sources');
		this.icon = 'grid';
	}

	getDefaultSourceUrls() {
		return ['https://github.com/unbound-mod/sources/blob/main/test/test.json?raw=true'];
	}

	async initialize() {
		// Load default sources
		// -
		// Reload every other source installed at initialization.
		// This will ensure that the user gets the most up-to-date information
		// -
		// Finally load the sources so they can appear in the UI
		this.initialized = true;
	}

	override async fetchBundle(_: string, _manifest: Manifest, setState: Fn<any>): Promise<any> {
		const manifest = _manifest as unknown as SourceManifest;
		const bundle = [] satisfies Bundle;

		for (const addon of manifest.addons) {
			const parsed = {} as Bundle[number];

			const manifest = await fetch(addon.manifest, { cache: 'no-cache' })
				.then(res => res.json())
				.catch(console.error);

			this.validateAddonManifest(manifest);
			Object.assign(parsed, { manifest });

			const changelog = await fetch(addon.changelog, { cache: 'no-cache' })
				.then(res => res.json())
				.catch(console.error);

			this.validateChangelog(changelog);
			Object.assign(parsed, { changelog });

			if (addon.readme) {
				const path = `${this.path}/${manifest.id}/readme.md`;

				downloadFile(addon.readme, path, null);
				Object.assign(parsed, { readme: path });
			}

			if (addon.screenshots) {
				const screenshots = [];

				for (const screenshot of addon.screenshots) {
					const name = screenshot.substring(screenshot.lastIndexOf('/') + 1);
					const path = `${this.path}/${manifest.id}/screenshots/${name}`;
					downloadFile(screenshot, path, null);

					screenshots.push(path);
				}

				Object.assign(parsed, { screenshots });
			}

			bundle.push(parsed);
		}

		return bundle;
	}

	override save(_bundle: string, manifest: Manifest) {
		const bundle = _bundle as unknown as Bundle;
		DCDFileManager.writeFile('documents', `${this.path}/${manifest.id}/bundle.json`, JSON.stringify(bundle, null, 2), 'utf8');
		DCDFileManager.writeFile('documents', `${this.path}/${manifest.id}/manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');
	}

	validateAddonManifest(manifest: Manifest) {
		if (!manifest.name || typeof manifest.name !== 'string') {
			throw new Error('Manifest property "name" must be of type string.');
		} else if (!manifest.description || typeof manifest.description !== 'string') {
			throw new Error('Manifest property "description" must be of type string.');
		} else if (!manifest.authors || (typeof manifest.name !== 'object' && !Array.isArray(manifest.authors))) {
			throw new Error('Manifest property "authors" must be of type array.');
		} else if (!manifest.version || typeof manifest.version !== 'string' || !Regex.SemanticVersioning.test(manifest.version)) {
			throw new Error('Manifest property "version" must be of type string and match the semantic versioning pattern.');
		} else if (!manifest.id || typeof manifest.id !== 'string') {
			throw new Error('Manifest property "id" must be of type string and match a "eternal.unbound" pattern.');
		}
	}

	validateChangelog(changelog: Record<string, string[]>) {
		if (!Object.keys(changelog).every(key => typeof key === 'string' && Regex.SemanticVersioning.test(key))
			|| !Object.values(changelog).every(value => Array.isArray(value) && value.every(message => typeof message === 'string'))) {
			throw new Error('The changelog object must be an object of string keys and string values, where the key is the version and the value is an array of strings.');
		}
	}

	override validateManifest(_manifest: Manifest): void {
		const manifest = _manifest as unknown as SourceManifest;

		if (!manifest.name || typeof manifest.name !== 'string') {
			throw new Error('Source property "name" must be of type string.');
		} else if (!manifest.id || typeof manifest.id !== 'string') {
			throw new Error('Source property "id" must be of type string and match a "eternal.unbound" pattern.');
		} else if (manifest.tags && (!Array.isArray(manifest.tags) || !manifest.tags.every(tag => typeof tag === 'string'))) {
			throw new Error('Source property "tags" must either not exist or be an array of type "string".');
		} else if (!manifest.addons || manifest.addons.length < 1) {
			throw new Error('Source must contain at least 1 addon.');
		} else if (manifest.iconType && (typeof manifest.iconType !== 'string' || !['basic', 'custom'].includes(manifest.iconType))) {
			throw new Error('Source icon type must be of type "string" and must be either "basic" or "custom"');
		}

		manifest.addons.forEach(addon => {
			if (!addon.name || typeof addon.name !== 'string') {
				throw new Error('Addon property "name" must be of type string.');
			} else if (!addon.type || typeof addon.type !== 'string' || !isValidManager(addon.type)) {
				throw new Error('Addon property "name" must be of type string.');
			} else if (addon.iconType && (typeof addon.iconType !== 'string' || !['basic', 'custom'].includes(addon.iconType))) {
				throw new Error('Addon icon type must be of type "string" and must be either "basic" or "custom"');
			} else if (addon.changelog && typeof addon.changelog !== 'string') {
				throw new Error('Addon property "changelog" must be of type string.');
			} else if (addon.readme && typeof addon.readme !== 'string') {
				throw new Error('Addon property "readme" must be of type string.');
			} else if (!addon.manifest || typeof addon.manifest !== 'string') {
				throw new Error('Addon property "manifest" must be of type string.');
			} else if (addon.screenshots && (!Array.isArray(addon.screenshots) || !addon.screenshots.every(screenshot => typeof screenshot === 'string'))) {
				throw new Error('Addon property "screenshots" must either not exist or be an array of type "string".');
			}
		});
	}

	override isEnabled(id: string): boolean {
		return true;
	}

	override handleBundle(bundle: string): string {
		return bundle;
	}
}

export default new Sources();