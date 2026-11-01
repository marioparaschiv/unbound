import type { IconPack, IconPackManifest, Plugin, UnboundAsset } from '@unbound-app/types';
import toError from '@unbound-app/utils/to-error';
import noop from '@unbound-app/utils/noop';

import { safeRelativePath, isSafeIconPackMain } from '~/addons/paths';
import type { Addon, AddonResolveable } from '~/addons/addon';
import { getById, onAssetRegistered } from '~/assets/api';
import { downloadManifest } from '~/addons/download';
import { ImageSources } from '~/metro/common';
import { Manager } from '~/addons/manager';
import { Addons } from '~/addons/addons';
import fs from '~/native/fs';

/** A single entry in a GitHub repo's recursive tree listing. */
type GitTreeNode = {
	path: string;
	type: string;
};

// UNKNOWN: one entry of GitHub's tree response.
function isTreeNode(value: unknown): value is GitTreeNode {
	return (
		typeof value === 'object' &&
		value !== null &&
		'path' in value &&
		typeof value.path === 'string' &&
		'type' in value &&
		typeof value.type === 'string'
	);
}

// UNKNOWN: GitHub's `git/trees` response body.
function treeNodes(body: unknown): GitTreeNode[] {
	if (
		typeof body !== 'object' ||
		body === null ||
		!('tree' in body) ||
		!Array.isArray(body.tree)
	) {
		throw new Error('GitHub answered the tree request in an unexpected shape.');
	}

	return body.tree.filter(isTreeNode);
}

/** The built-in pack: a no-op passthrough that renders Discord's own icons. */
const defaultPack: IconPack = {
	bundle: 'Default',
	manifest: {
		id: 'default',
		name: 'Default',
		description: "Discord's default icons.",
		authors: [{ name: 'Discord', id: '263689920210534400' }],
		main: '',
		version: '1.0.0',
		type: 'icon-pack',
		source: 'other',
	} satisfies IconPackManifest,
};

/**
 * @description Manages icon packs. A pack is a folder of image files mirroring Discord's asset tree;
 * the applied pack rewrites `Image` sources to the on-disk files. Single-select, like themes.
 */
export class Icons extends Addons<Plugin> {
	extension = 'png';

	// Stops stamping assets that register after the applied pack.
	private stopStamping = noop;

	constructor() {
		super({
			kind: 'icon-pack',
			name: 'Icons',
			directory: 'Unbound/Icons',
			bucket: 'icons',
			label: 'UNBOUND_ICONS',
			icon: 'ImageIcon',
		});

		Manager.register('icon-pack', this);
	}

	/**
	 * @description Accepts the built-in pack's empty `main`, a GitHub tree URL to download from, or a relative path.
	 * @param main The manifest's `main`.
	 * @returns Whether an icon pack may use it.
	 */
	protected isAcceptableMain(main: unknown): main is string {
		return isSafeIconPackMain(main);
	}

	get applied(): IconPack {
		return this.settings.get('applied', defaultPack);
	}

	initialize() {
		for (const pack of this.settings.get<IconPack[]>('packs', [defaultPack])) {
			this.load(pack.bundle, pack.manifest);
		}

		this.applyPack(this.applied.manifest.id).catch((error) => {
			this.logger.error('Failed to apply icon pack on init:', error);
		});
		this.initialized = true;
	}

	protected handleBundle(): null {
		return null;
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
	toggle(entity: AddonResolveable) {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		if (this.isEnabled(resolved.id)) {
			this.disable(resolved);
		} else {
			this.enable(resolved);
		}

		this.emit('toggled', resolved);
	}

	async enable(entity: AddonResolveable) {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);
			const pack = packs.find((p) => p.manifest.id === resolved.id) ?? defaultPack;

			this.settings.set('applied', pack);

			this.removePack();
			await this.applyPack(resolved.id);

			this.emit('enabled', resolved);
		} catch (error) {
			this.logger.error(`Failed to enable icon pack ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}

	disable(entity: AddonResolveable) {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			this.settings.set('applied', defaultPack);
			this.removePack();

			this.emit('disabled', resolved);
		} catch (error) {
			this.logger.error(`Failed to disable icon pack ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}

	/**
	 * @description Re-applies the pack if it is the applied one, re-reading its files from disk.
	 * @param entity The pack to restart, as its id or the entity itself.
	 */
	async restart(entity: AddonResolveable): Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved || !this.isEnabled(resolved.id)) return;

		try {
			this.removePack();
			await this.applyPack(resolved.id);
		} catch (error) {
			this.logger.error(`Failed to restart icon pack ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}

	async delete(entity: AddonResolveable): Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			if (this.applied.manifest.id === resolved.id) {
				this.disable(resolved);
			}

			const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);

			this.settings.set(
				'packs',
				packs.filter((p) => p.manifest.id !== resolved.id),
			);

			this.unload(resolved);
			await fs.removeFile(this.directoryOf(resolved.id));
			this.forgetSource(resolved.id);

			this.emit('deleted', resolved);
		} catch (error) {
			this.logger.error(`Failed to delete icon pack ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}

	/**
	 * @description Applies a pack: stamps every registered asset with its on-disk override path, then
	 * patches the source resolution of every `Image` render to swap numeric sources for the pack's files.
	 * Stamps are awaited before the patch installs, so no image renders against an un-stamped asset.
	 * Assets that register later are stamped as they register.
	 * @param id The pack id to apply. The `default` pack is a no-op.
	 */
	async applyPack(id: string) {
		if (id === 'default') return;

		const stamps: Array<Promise<void>> = [];

		this.stopStamping();
		this.stopStamping = onAssetRegistered((asset) => void this.stampAsset(id, asset));

		for (let assetId = 1; ; assetId++) {
			const asset = getById(assetId);

			if (!asset) {
				break;
			}

			stamps.push(this.stampAsset(id, asset));
		}

		await Promise.all(stamps);

		// Every `Image` render resolves its source through this helper, which it reads off the module at call time.
		this.patcher.before(ImageSources, 'getImageSourcesFromImageProps', ({ args: [props] }) => {
			if (typeof props?.source !== 'number') return;

			const asset = getById(props.source);

			if (!asset?.iconPackPath || !asset.iconPackScale) return;

			const source = {
				uri: `file://${asset.iconPackPath}`,
				width: asset.width,
				height: asset.height,
				scale: asset.iconPackScale,
			};

			return [{ ...props, source }];
		});
	}

	shutdown(): Promise<void> {
		this.removePack();

		return super.shutdown();
	}

	private removePack() {
		this.patcher.unpatchAll();
		this.stopStamping();
		this.stopStamping = noop;
	}

	/**
	 * @description Stamps a single asset with the highest-scale override file present in the pack, or clears it.
	 * @param id The pack id.
	 * @param asset The registered asset to stamp.
	 */
	protected async stampAsset(id: string, asset: UnboundAsset) {
		const scales = [...asset.scales].sort((a, b) => b - a);

		delete asset.iconPackPath;
		delete asset.iconPackScale;

		for (const scale of scales) {
			const relative = this.relativeAssetPath(asset, scale);
			const path = `${this.directoryOf(id)}/${relative}`;

			if (await fs.exists(path)) {
				asset.iconPackPath = `${fs.documentsPath}/${path}`;
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
	protected relativeAssetPath(asset: UnboundAsset, scale: number): string {
		const dir = asset.httpServerLocation.replace(/\/assets\/(.*)/, '$1');

		return `${dir}/${asset.name}${scale > 1 ? `@${scale}x` : ''}.${asset.type}`;
	}

	/**
	 * @description Installs an icon pack. GitHub manifests download the repo's image tree into the pack
	 * folder; other manifests fall back to the shared bundle install.
	 * @param url The manifest URL.
	 * @param digest The SHA-256 a bundle-based pack's bundle must have, when the release lists one.
	 * @returns The loaded pack entity, or `undefined` on failure.
	 */
	async install(url: string, digest?: string): Promise<Addon | undefined> {
		try {
			const parsed = await downloadManifest(url, (raw) => this.validateManifest(raw));

			if (parsed.type && parsed.type !== this.kind) {
				throw new Error(`Expected a icon-pack manifest, got ${parsed.type}.`);
			}

			const declared: unknown = Reflect.get(parsed, 'source');
			const manifest: IconPackManifest = {
				...parsed,
				type: 'icon-pack',
				source:
					declared === undefined || declared === null
						? /^https?:\/\/(www\.)?github\.com/.test(parsed.main)
							? 'github'
							: 'other'
						: declared === 'github'
							? 'github'
							: 'other',
			};

			if (manifest.source !== 'github') {
				return super.install(url, digest);
			}

			await this.downloadTree(manifest);

			const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);

			this.settings.set('packs', [
				...packs.filter((p) => p.manifest.id !== manifest.id),
				{ bundle: manifest.name, manifest },
			]);

			this.load(manifest.name, manifest);
			const entity = this.getEntity(manifest.id);

			if (entity) {
				this.recordSource(entity.id, url);
				this.emit('installed', entity);
			}

			return entity;
		} catch (error) {
			this.logger.error('Failed to install icon pack:', error);
			this.emit('install-error', toError(error));

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

		if (!match) {
			throw new Error('Not a GitHub repo URL.');
		}

		const [, user, repo, branch, path] = match;
		const ref = branch ?? 'main';
		const sub = path ?? '';

		const api = `https://api.github.com/repos/${user}/${repo}/git/trees/${ref}?recursive=1`;
		const tree = treeNodes(await fetch(api).then((res) => res.json()));

		const blobs = tree.filter(
			(node) => node.type === 'blob' && (!sub || node.path.startsWith(`${sub}/`)),
		);

		for (let i = 0; i < blobs.length; i += 50) {
			const batch = blobs.slice(i, i + 50);

			await Promise.all(
				batch.map(async (node) => {
					const raw = `https://raw.githubusercontent.com/${user}/${repo}/${ref}/${node.path}`;
					const relative = safeRelativePath(
						sub ? node.path.slice(sub.length + 1) : node.path,
					);

					if (!relative) {
						this.logger.warn(`Skipping icon ${node.path}: its path leaves the pack.`);

						return;
					}

					const buf = await fetch(raw).then((res) => res.arrayBuffer());
					const data = Buffer.from(buf).toString('base64');

					await fs.writeFile(
						`${this.directoryOf(manifest.id)}/${relative}`,
						data,
						'base64',
					);
				}),
			);
		}
	}
}

/** @internal */
export const icons = new Icons();
