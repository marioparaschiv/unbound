import type { Addon, IconPack, IconPackManifest } from '@unbound-app/types';

import { Assets, ReactNative as RN } from '~/api/metro/common';
import { ManagerType } from '~/managers/base';
import { Addons } from '~/managers/addons';
import fs from '~/api/fs';

/** A single entry in a GitHub repo's recursive tree listing. */
type GitTreeNode = {
	path: string;
	type: string;
};

/** The built-in pack: a no-op passthrough that renders Discord's own icons. */
export const defaultPack: IconPack = {
	bundle: 'Default',
	manifest: {
		id: 'default',
		name: 'Default',
		description: "Discord's default icons.",
		authors: [{ name: 'Discord', id: '263689920210534400' }],
		icon: '',
		updates: '',
		main: '',
		folder: '',
		path: '',
		url: '',
		version: '1.0.0',
		type: 'icon-pack',
		source: 'other',
	} satisfies IconPackManifest,
};

/**
 * @description Manages icon packs. A pack is a folder of image files mirroring Discord's asset tree;
 * the applied pack rewrites `Image` sources to the on-disk files. Single-select, like themes.
 */
export class Icons extends Addons<Addon> {
	extension = 'png';

	constructor() {
		super(ManagerType.ICONS);
	}

	protected get entityType() {
		return 'icon-pack' as const;
	}

	get applied(): IconPack {
		return this.settings.get('applied', defaultPack);
	}

	initialize() {
		for (const pack of this.settings.get<IconPack[]>('packs', [defaultPack])) {
			this.load(pack.bundle, pack.manifest);
		}

		this.applyPack(this.applied.manifest.id).catch((error: any) => {
			this.logger.error('Failed to apply icon pack on init:', error);
		});
		this.initialized = true;
	}

	protected handleBundle(bundle: string): string {
		return bundle;
	}

	isEnabled(id: string): boolean {
		return this.applied.manifest.id === id;
	}

	/**
	 * @description Enables the pack if it isn't applied, disables it if it is, and emits `toggled`.
	 * Icons are single-select: the applied pack lives in `applied`, not the base `states` map, so
	 * {@link isEnabled} decides the direction here.
	 * @param entity The pack to toggle, as its id or the entity itself.
	 */
	toggle(entity: string | Addon) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		if (this.isEnabled(resolved.id)) {
			this.disable(resolved);
		} else {
			this.enable(resolved);
		}

		this.emit('toggled', resolved);
	}

	async enable(entity: string | Addon) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);
			const pack = packs.find((p) => p.manifest.id === resolved.id) ?? defaultPack;
			this.settings.set('applied', pack);

			this.patcher.unpatchAll();
			await this.applyPack(resolved.id);

			this.emit('enabled', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to enable icon pack ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	disable(entity: string | Addon) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			this.settings.set('applied', defaultPack);
			this.patcher.unpatchAll();

			this.emit('disabled', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to disable icon pack ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	async delete(entity: string | Addon): Promise<void> {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			if (this.applied.manifest.id === resolved.id) this.disable(resolved);

			const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);
			this.settings.set(
				'packs',
				packs.filter((p) => p.manifest.id !== resolved.id),
			);

			this.unload(resolved);
			await fs.rm(`Unbound/Icons/${resolved.id}`);

			this.emit('deleted', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to delete icon pack ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	/**
	 * @description Applies a pack: stamps every registered asset with its on-disk override path, then
	 * patches `Image.render` to swap numeric sources for the pack's files. Stamps are awaited before
	 * the patch installs, so no image renders against an un-stamped asset.
	 * @param id The pack id to apply. The `default` pack is a no-op.
	 */
	async applyPack(id: string) {
		if (id === 'default') return;

		const stamps: Array<Promise<void>> = [];
		for (let assetId = 1; ; assetId++) {
			const asset = Assets.getAssetByID(assetId);
			if (!asset) break;
			stamps.push(this.stampAsset(id, asset));
		}
		await Promise.all(stamps);

		this.patcher.before(RN.Image.prototype, 'render', ({ this: self }: any) => {
			const props = self.props;
			if (typeof props?.source !== 'number') return;

			const asset = Assets.getAssetByID(props.source);
			if (asset?.iconPackPath && asset.iconPackScale) {
				props.source = {
					uri: `file://${asset.iconPackPath}`,
					width: asset.width,
					height: asset.height,
					scale: asset.iconPackScale,
				};
			}
		});
	}

	/**
	 * @description Stamps a single asset with the highest-scale override file present in the pack, or clears it.
	 * @param id The pack id.
	 * @param asset The registered asset to stamp.
	 */
	protected async stampAsset(id: string, asset: any) {
		const scales = [...asset.scales].sort((a: number, b: number) => b - a);

		delete asset.iconPackPath;
		delete asset.iconPackScale;

		for (const scale of scales) {
			const relative = this.relativeAssetPath(asset, scale);
			const path = `Unbound/Icons/${id}/${relative}`;

			if (await fs.exists(path)) {
				asset.iconPackPath = `${fs.Documents}/${path}`;
				asset.iconPackScale = scale;
				break;
			}
		}
	}

	/**
	 * @description Builds an asset's on-disk relative path for a scale, mirroring Discord's asset tree.
	 * @param asset The asset.
	 * @param scale The scale variant.
	 * @returns The path relative to the pack folder.
	 */
	protected relativeAssetPath(asset: any, scale: number): string {
		const dir = asset.httpServerLocation.replace(/\/assets\/(.*)/, '$1');
		return `${dir}/${asset.name}${scale > 1 ? `@${scale}x` : ''}.${asset.type}`;
	}

	/**
	 * @description Installs an icon pack. GitHub manifests download the repo's image tree into the pack
	 * folder; other manifests fall back to the shared bundle install.
	 * @param url The manifest URL.
	 * @returns The loaded pack entity, or `undefined` on failure.
	 */
	async install(url: string): Promise<Addon | undefined> {
		try {
			const manifest: IconPackManifest = await fetch(url, { cache: 'no-cache' }).then(
				(res) => {
					if (!res.ok) throw new Error(`Failed to fetch manifest (${res.status}).`);
					return res.json();
				},
			);

			this.validateManifest(manifest);

			if (manifest.type && manifest.type !== this.entityType) {
				throw new Error(`Expected a ${this.entityType} manifest, got ${manifest.type}.`);
			}

			manifest.source ??= /^https?:\/\/(www\.)?github\.com/.test(manifest.main)
				? 'github'
				: 'other';

			if (manifest.source !== 'github') return super.install(url);

			await this.downloadTree(manifest);

			const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);
			this.settings.set('packs', [
				...packs.filter((p) => p.manifest.id !== manifest.id),
				{ bundle: manifest.name, manifest },
			]);

			this.load(manifest.name, manifest);
			const entity = this.getEntity(manifest.id);
			if (entity) this.emit('installed', entity);

			return entity;
		} catch (error: any) {
			this.logger.error('Failed to install icon pack:', error);
			this.emit('install-error', error);
			return undefined;
		}
	}

	/**
	 * @description Downloads every blob under a GitHub repo path into the pack folder, in batches.
	 * @param manifest The pack manifest whose `main` is a GitHub URL.
	 */
	protected async downloadTree(manifest: IconPackManifest) {
		const match = manifest.main.match(
			/https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?\/?(.*)?/,
		);
		if (!match) throw new Error('Not a GitHub repo URL.');

		const [, user, repo, branch, path] = match;
		const ref = branch ?? 'main';
		const sub = path ?? '';

		const api = `https://api.github.com/repos/${user}/${repo}/git/trees/${ref}?recursive=1`;
		const tree: GitTreeNode[] = await fetch(api)
			.then((res) => res.json())
			.then((json) => json.tree ?? []);

		const blobs = tree.filter(
			(node) => node.type === 'blob' && (!sub || node.path.startsWith(`${sub}/`)),
		);

		for (let i = 0; i < blobs.length; i += 50) {
			const batch = blobs.slice(i, i + 50);
			await Promise.all(
				batch.map(async (node) => {
					const raw = `https://raw.githubusercontent.com/${user}/${repo}/${ref}/${node.path}`;
					const relative = sub ? node.path.slice(sub.length + 1) : node.path;
					const buf = await fetch(raw).then((res) => res.arrayBuffer());
					const data = Buffer.from(buf).toString('base64');
					await fs.write(`Unbound/Icons/${manifest.id}/${relative}`, data, 'base64');
				}),
			);
		}
	}
}

export const icons = new Icons();
