import type {
	AddonManifest,
	IconPack,
	IconPackManifest,
	Plugin,
	UnboundAsset,
} from '@unbound-app/types';
import { ASSET_SCALES, getAssetPath } from '@unbound-app/contracts/addon-assets';
import toError from '@unbound-app/utils/to-error';
import noop from '@unbound-app/utils/noop';

import { safeRelativePath, isSafeIconPackMain } from '~/addons/paths';
import { indexedIcons, listedIcons } from '~/icon-packs/pack-icons';
import type { Addon, AddonResolveable } from '~/addons/addon';
import type { InstalledEntry } from '~/updates/addon-updates';
import { refreshImages } from '~/icon-packs/refresh-images';
import { getById, onAssetRegistered } from '~/assets/api';
import { downloadFile } from '~/native/download-file';
import { getSha256 } from '~/native/unbound-native';
import type { AddonFiles } from '~/addons/files';
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

/** A pack file standing in for one asset: its absolute path and the scale it was drawn at. */
export type IconFile = {
	path: string;
	scale: number;
};

/** The list of a GitHub pack's files, written at install so applying it reads no file per asset. */
const INDEX_FILE = 'index.json';

// UNKNOWN: the parsed index file.
function isPathList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

// Points an asset at a pack file, or back at Discord's own when the pack has none.
function stamp(asset: UnboundAsset, file: IconFile | undefined) {
	if (!file) {
		delete asset.iconPackPath;
		delete asset.iconPackScale;

		return;
	}

	asset.iconPackPath = file.path;
	asset.iconPackScale = file.scale;
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
	// Stops stamping assets that register after the applied pack.
	private stopStamping = noop;
	// Each pack's file list, read once; `undefined` for a pack installed without one.
	private indexes = new Map<string, Promise<Set<string> | undefined>>();

	constructor() {
		super({
			kind: 'icon-pack',
			name: 'Icons',
			directory: 'Unbound/Icons',
			bucket: 'icons',
			label: 'UNBOUND_ICONS',
			noun: 'UNBOUND_ICONS_NOUN',
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

	/**
	 * @description Lists the installed packs for an update check, leaving out the built-in default pack.
	 * A pack loads from settings without its bundle, so each entry carries the digest recorded at install.
	 * @returns One entry per installed pack; without a recorded digest, none is sent.
	 */
	listInstalled(): InstalledEntry[] {
		const digests = this.getDigests();

		return super
			.listInstalled()
			.filter((entry) => entry.id !== defaultPack.manifest.id)
			.map(({ kind, id, name, version }) => {
				const sha256 = digests[id];

				return sha256 ? { kind, id, name, version, sha256 } : { kind, id, name, version };
			});
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
	 * @description Applies a pack, replacing the one applied before, and emits `enabled`. Icons are
	 * single-select: the applied pack lives in `applied`, not the base `states` map.
	 * @param entity The pack to enable, as its id or the entity itself.
	 */
	async enable(entity: AddonResolveable) {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);
			const pack = packs.find((p) => p.manifest.id === resolved.id) ?? defaultPack;

			this.settings.set('applied', pack);

			if (resolved.id === defaultPack.manifest.id) {
				this.removePack();
			} else {
				await this.applyPack(resolved.id);
			}

			refreshImages();

			this.emit('enabled', resolved);
		} catch (error) {
			this.fail('enable', resolved.id, error, 'icon pack');
		}
	}

	disable(entity: AddonResolveable) {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			this.settings.set('applied', defaultPack);
			this.removePack();
			refreshImages();

			this.emit('disabled', resolved);
		} catch (error) {
			this.fail('disable', resolved.id, error, 'icon pack');
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
			this.indexes.delete(resolved.id);
			await this.applyPack(resolved.id);
			refreshImages();
		} catch (error) {
			this.fail('restart', resolved.id, error, 'icon pack');
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
			this.indexes.delete(resolved.id);
			await fs.removeFile(this.directoryOf(resolved.id));
			this.forgetSource(resolved.id);
			this.forgetDigest(resolved.id);

			this.emit('deleted', resolved);
		} catch (error) {
			this.fail('delete', resolved.id, error, 'icon pack');
		}
	}

	/**
	 * @description Applies a pack, replacing the applied one: finds every registered asset's file, then stamps them all and
	 * swaps the `Image` source patch in one synchronous step, so no frame draws Discord's icons or a mix of two packs.
	 * Assets that register later are stamped as they register.
	 * @param id The pack id to apply. The `default` pack is a no-op.
	 */
	async applyPack(id: string) {
		if (id === defaultPack.manifest.id) return;

		// Read once: the pack list crosses the native settings bridge whole, about 1.5 ms per read.
		const manifest = this.findPack(id)?.manifest;
		const files = await this.readIndex(id);
		const assets: UnboundAsset[] = [];

		this.stopStamping();
		this.stopStamping = onAssetRegistered(
			(asset) => void this.stampAsset(id, asset, files, manifest),
		);

		for (let assetId = 1; ; assetId++) {
			const asset = getById(assetId);

			if (!asset) {
				break;
			}

			assets.push(asset);
		}

		const found = await Promise.all(
			assets.map(async (asset) => this.lookupFile(id, asset, files, manifest)),
		);

		for (const [index, asset] of assets.entries()) {
			stamp(asset, found[index]);
		}

		this.patcher.unpatchAll();

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
	 * @description Finds the file a pack draws an asset with, without applying the pack, so a picker can preview it.
	 * @param id The pack id; the built-in `default` pack has no files.
	 * @param asset The asset.
	 * @returns The highest-scale file the pack has for it, or `undefined` when it keeps Discord's.
	 */
	async findIconFile(id: string, asset: UnboundAsset): Promise<IconFile | undefined> {
		if (id === defaultPack.manifest.id) return;

		return this.lookupFile(id, asset, await this.readIndex(id), this.findPack(id)?.manifest);
	}

	/**
	 * @description Lists every icon a pack draws, one file per icon at its highest scale, so a picker can show them all.
	 * @param id The pack id; the built-in `default` pack has none.
	 * @returns The files, or none for a GitHub pack installed before indexes.
	 */
	async listIconFiles(id: string): Promise<IconFile[]> {
		if (id === defaultPack.manifest.id) {
			return [];
		}

		const manifest = this.findPack(id)?.manifest;
		const icons = manifest?.assets
			? listedIcons(manifest)
			: indexedIcons((await this.readIndex(id)) ?? []);
		const directory = `${fs.documentsPath}/${this.directoryOf(id)}`;

		return icons.map(({ path, scale }) => ({ path: `${directory}/${path}`, scale }));
	}

	// Manifest and index lookups answer at once: Discord registers an icon mid-render, and that render reads
	// the stamp. Only a GitHub pack installed before indexes asks the disk.
	private lookupFile(
		id: string,
		asset: UnboundAsset,
		files: Set<string> | undefined,
		manifest: AddonManifest | undefined,
	): IconFile | undefined | Promise<IconFile | undefined> {
		const scales = [...asset.scales].sort((a, b) => b - a);

		if (manifest?.assets) {
			return this.findListedFile(manifest, asset, scales);
		}

		if (files) {
			const scale = scales.find((value) => files.has(this.relativeAssetPath(asset, value)));

			return scale === undefined ? undefined : this.packFile(id, asset, scale);
		}

		return this.findFileOnDisk(id, asset, scales);
	}

	private async findFileOnDisk(
		id: string,
		asset: UnboundAsset,
		scales: number[],
	): Promise<IconFile | undefined> {
		for (const scale of scales) {
			if (
				await fs.exists(`${this.directoryOf(id)}/${this.relativeAssetPath(asset, scale)}`)
			) {
				return this.packFile(id, asset, scale);
			}
		}

		return undefined;
	}

	private packFile(id: string, asset: UnboundAsset, scale: number): IconFile {
		return {
			path: `${fs.documentsPath}/${this.directoryOf(id)}/${this.relativeAssetPath(asset, scale)}`,
			scale,
		};
	}

	// Store packs name each image by content, under the asset's Discord path without its scale and type.
	private findListedFile(
		manifest: AddonManifest,
		asset: UnboundAsset,
		scales: number[],
	): IconFile | undefined {
		const listed = manifest.assets?.[this.assetName(asset)];

		if (!listed || listed.type !== asset.type) return;

		for (const scale of scales) {
			const key = ASSET_SCALES.find((value) => Number(value) === scale);
			const sha256 = key && listed.scales[key];

			if (sha256) {
				const path = getAssetPath(manifest.main, sha256, listed.type);

				return {
					path: `${fs.documentsPath}/${this.directoryOf(manifest.id)}/${path}`,
					scale,
				};
			}
		}

		return undefined;
	}

	private findPack(id: string): IconPack | undefined {
		return this.settings
			.get<IconPack[]>('packs', [defaultPack])
			.find((p) => p.manifest.id === id);
	}

	// Every installed pack is listed here, which `initialize` loads from on the next launch.
	private recordPack(manifest: IconPackManifest) {
		const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);

		this.settings.set('packs', [
			...packs.filter((p) => p.manifest.id !== manifest.id),
			{ bundle: manifest.name, manifest },
		]);
	}

	/**
	 * @description Writes a store pack's manifest and bundle, recording the bundle's SHA-256 for update checks.
	 * @param bundle The pack's bundle, which lists its images.
	 * @param manifest The pack's validated manifest.
	 */
	protected async persist(bundle: string, manifest: AddonManifest): Promise<void> {
		await super.persist(bundle, manifest);
		this.settings.set('digests', { ...this.getDigests(), [manifest.id]: getSha256(bundle) });
	}

	// Each store pack's bundle digest by id; `initialize` loads packs with their name in place of the bundle.
	private getDigests(): Record<string, string> {
		return this.settings.get('digests', {});
	}

	private forgetDigest(id: string) {
		const digests = this.getDigests();

		if (!(id in digests)) return;

		delete digests[id];
		this.settings.set('digests', digests);
	}

	/**
	 * @description Writes a store pack's images, lists the pack, and re-applies it when it is the applied one, since an
	 * update replaces the images its icons point at.
	 * @param manifest The pack's validated manifest.
	 * @param files The images, base64-encoded, by path.
	 */
	protected async persistFiles(manifest: AddonManifest, files?: AddonFiles): Promise<void> {
		await super.persistFiles(manifest, files);
		this.recordPack({ ...manifest, type: 'icon-pack', source: 'other' });
		await this.restart(manifest.id);
	}

	private readIndex(id: string): Promise<Set<string> | undefined> {
		const cached = this.indexes.get(id);

		if (cached) {
			return cached;
		}

		const read = fs
			.readFile(`${this.directoryOf(id)}/${INDEX_FILE}`)
			.then((text) => {
				const value: unknown = JSON.parse(text);

				return isPathList(value) ? new Set(value) : undefined;
			})
			.catch(() => undefined);

		this.indexes.set(id, read);

		return read;
	}

	/**
	 * @description Stamps a single asset with the highest-scale override file present in the pack, or clears it.
	 * @param id The pack id.
	 * @param asset The registered asset to stamp.
	 * @param files The pack's file list, when it has one.
	 * @param manifest The pack's manifest, read once per apply.
	 * @returns A promise only when the pack must ask the disk; otherwise the asset is stamped on return.
	 */
	protected stampAsset(
		id: string,
		asset: UnboundAsset,
		files: Set<string> | undefined,
		manifest: AddonManifest | undefined,
	): Promise<void> | void {
		const file = this.lookupFile(id, asset, files, manifest);

		if (file instanceof Promise) {
			return file.then((found) => stamp(asset, found));
		}

		stamp(asset, file);
	}

	/**
	 * @description Builds an asset's on-disk relative path for a scale, mirroring Discord's asset tree.
	 * @param asset The asset.
	 * @param scale The scale variant.
	 * @returns The path relative to the pack folder.
	 */
	protected relativeAssetPath(asset: UnboundAsset, scale: number): string {
		return `${this.assetName(asset)}${scale > 1 ? `@${scale}x` : ''}.${asset.type}`;
	}

	/**
	 * @description Names an asset by its path in Discord's asset tree, without its scale and type.
	 * @param asset The asset.
	 * @returns The name, such as `design/components/Icon/native/redesign/generated/images/SettingsIcon`.
	 */
	protected assetName(asset: UnboundAsset): string {
		const dir = asset.httpServerLocation.replace(/\/assets\/(.*)/, '$1');

		return `${dir}/${asset.name}`;
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
			const parsed = await this.fetchManifest(url);

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
			this.recordPack(manifest);
			this.forgetDigest(manifest.id);

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

		const written: string[] = [];

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

					await downloadFile(raw, `${this.directoryOf(manifest.id)}/${relative}`);
					written.push(relative);
				}),
			);
		}

		await fs.writeFile(
			`${this.directoryOf(manifest.id)}/${INDEX_FILE}`,
			JSON.stringify(written),
		);
		this.indexes.delete(manifest.id);
	}
}

/** @internal */
export const icons = new Icons();
