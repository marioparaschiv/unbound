import type { Addon, Manifest } from '@typings/managers';
import type { Manager } from '@typings/managers';
import { Dispatcher } from '@api/metro/common';
import { createPatcher } from '@patcher';
import { download } from '@utilities';
import { Icons } from '@api/assets';
import { Regex } from '@constants';
import { useMemo } from 'react';
import fs from '@api/fs';

import BaseManager, { ManagerType, isValidManager } from './base';

export type SourceManifest = Pick<Manifest, 'id' | 'name' | 'description' | 'icon' | 'url'> & {
	iconType?: string;
	tags: string[];
	addons: {
		type: string;
		screenshots: string[];
		changelog: string;
		manifest: string;
		readme: string;
		suggest: string[];
	}[];
};

export type Bundle = {
	type: Manager;
	source: string,
	manifest: Manifest;
	changelog: Record<string, string[]>;
	readme?: string;
	screenshots?: string[];
	suggest?: string[];
}[];

export function useIcon(icon: Bundle[number]['manifest']['icon']) {
	return useMemo(() => typeof icon === 'string' ? Icons[icon] : icon, [icon]);
}

class Sources extends BaseManager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'json';
	public signal: AbortSignal;
	public sources: Record<Manifest['id'], Manifest['url']>;

	// Reload sources after 5 seconds or whenever the user
	// accesses the Sources page, whichever happens sooner
	public refreshed = false;

	constructor() {
		super(ManagerType.Sources);

		this.patcher = createPatcher('sources');
		this.icon = 'grid';
	}

	getDefaultSourceUrls() {
		return ['https://github.com/unbound-mod/sources/blob/main/test/test.json?raw=true'];
	}

	async initialize() {
		this.sources = this.settings.get('sources', null);

		if (!this.sources) {
			const defaultSources = this.getDefaultSourceUrls();

			for (const url of defaultSources) {
				await this.install(url);
			}
		}

		for (const source of Object.keys(this.sources)) {
			const manifest = await fs.read(`${this.path}/${source}/manifest.json`);
			const bundle = await fs.read(`${this.path}/${source}/bundle.json`);

			this.load(JSON.parse(bundle), JSON.parse(manifest) as Manifest);
		}

		Dispatcher.subscribe('REFRESH_SOURCES', async () => {
			for (const url of Object.values(this.sources)) {
				await this.install(url);
			}

			Dispatcher.dispatch({ type: 'REFRESH_SOURCES_COMPLETE' });
		});

		setTimeout(() => {
			if (!this.refreshed) {
				this.refreshed = true;
				Dispatcher.dispatch({ type: 'REFRESH_SOURCES' });
			}
		}, 5000);

		this.initialized = true;
	}

	override async onFinishedInstalling(addon: Addon, manifest: SourceManifest): Promise<Addon> {
		this.sources ??= {};
		this.sources[manifest.id] = manifest.url;
		this.settings.set('sources', this.sources);

		return addon;
	}

	override async fetchBundle(_: string, _manifest: Manifest, signal: AbortSignal, setState?: Fn<any>): Promise<any> {
		const manifest = _manifest as unknown as SourceManifest;
		const bundle: Bundle = [];

		for (const addon of manifest.addons) {
			const parsed = {} as Bundle[number];

			Object.assign(parsed, { type: addon.type });
			Object.assign(parsed, { source: manifest.id });

			const addonManifest = await fetch(addon.manifest, { cache: 'no-cache', signal })
				.then(res => res.json())
				.catch(console.error) as Manifest;

			try {
				this.validateAddonManifest(addonManifest);
			} catch (e) {
				this.logger.error('Failed to validate addon manifest:', e);
			}

			addonManifest.url = addon.manifest;
			Object.assign(parsed, { manifest: addonManifest });

			if (addon.changelog) {
				const changelog = await fetch(addon.changelog, { cache: 'no-cache', signal })
					.then(res => res.json())
					.catch(console.error);

				try {
					this.validateChangelog(changelog);
				} catch (e) {
					this.logger.error('Failed to validate addon changelog:', e);
				}

				Object.assign(parsed, { changelog });
			}

			if (addon.readme) {
				const readme = await fetch(addon.readme, { cache: 'no-cache', signal })
					.then(res => res.text())
					.catch(console.error);

				if (typeof readme !== 'string') throw new Error('Readme must be a string.');
				Object.assign(parsed, { readme });
			}

			if (addon.screenshots) {
				const screenshots = [];

				for (const screenshot of addon.screenshots) {
					const name = screenshot.substring(screenshot.lastIndexOf('/') + 1);
					const path = `${this.path}/${manifest.id}/${addonManifest.id}/screenshots/${name}`;
					download(screenshot, path, 'base64', signal);

					screenshots.push(path);
				}

				Object.assign(parsed, { screenshots });
			}

			if (addon.suggest) {
				if (!Array.isArray(addon.suggest) || !addon.suggest.every(id => id && typeof id === 'string')) {
					throw new Error('Suggestions must be an array of addon IDs');
				}

				Object.assign(parsed, { suggest: addon.suggest });
			}

			bundle.push(parsed);
		}

		for (const addon of bundle) {
			for (const id of addon?.suggest ?? []) {
				if (!bundle.find(addon => addon.manifest.id === id)) {
					throw new Error(`Suggestion ID ${id} does not point to a valid addon in this repository.`);
				}
			}
		}

		return bundle;
	}

	override save(_bundle: string, manifest: Manifest) {
		const bundle = _bundle as unknown as Bundle;
		fs.write(`${this.path}/${manifest.id}/bundle.json`, JSON.stringify(bundle, null, 2));
		fs.write(`${this.path}/${manifest.id}/manifest.json`, JSON.stringify(manifest, null, 2));
	}

	validateAddonManifest(manifest: Manifest) {
		if (!manifest.name || typeof manifest.name !== 'string') {
			throw new Error('Manifest property "name" must be of type string');
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
		// Ensure every key is a semantic version and every value is an array of strings
		if (!Object.keys(changelog).every(key => typeof key === 'string' && Regex.SemanticVersioning.test(key))
			|| !Object.values(changelog).every(value => Array.isArray(value) && value.every(message => typeof message === 'string'))) {
			throw new Error('The changelog object must be an object of string keys and string[] values, where the key is the version and the value is an array of strings.');
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
		} else if (!manifest.addons || !Array.isArray(manifest.addons) || manifest.addons.length < 1) {
			throw new Error('Source must contain at least 1 addon.');
		} else if (manifest.iconType && (typeof manifest.iconType !== 'string' || !['basic', 'custom'].includes(manifest.iconType))) {
			throw new Error('Source icon type must be of type "string" and must be either "basic" or "custom"');
		}

		for (const addon of manifest.addons) {
			if (!addon.type || typeof addon.type !== 'string' || !isValidManager(addon.type)) {
				throw new Error('Addon property "type" must be of type string and a valid manager, got ' + addon.type);
			} else if (addon.changelog && typeof addon.changelog !== 'string') {
				throw new Error('Addon property "changelog" must be of type string.');
			} else if (addon.readme && typeof addon.readme !== 'string') {
				throw new Error('Addon property "readme" must be of type string.');
			} else if (!addon.manifest || typeof addon.manifest !== 'string') {
				throw new Error('Addon property "manifest" must be of type string.');
			} else if (addon.screenshots && (!Array.isArray(addon.screenshots) || !addon.screenshots.every(screenshot => typeof screenshot === 'string'))) {
				throw new Error('Addon property "screenshots" must either not exist or be an array of "string".');
			}
		}
	}

	override isEnabled(id: string): boolean {
		return true;
	}

	override handleBundle(bundle: string): string {
		return bundle;
	}
}

export default new Sources();