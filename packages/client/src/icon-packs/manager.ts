import type { IconPack, IconPackManifest, Plugin, UnboundAsset } from '@unbound-app/types';
import toError from '@unbound-app/utils/to-error';
import noop from '@unbound-app/utils/noop';

import { safeRelativePath, isSafeIconPackMain } from '~/addons/paths';
import type { Addon, AddonResolveable } from '~/addons/addon';
import type { InstalledEntry } from '~/updates/addon-updates';
import { refreshImages } from '~/icon-packs/refresh-images';
import { getById, onAssetRegistered } from '~/assets/api';
import { downloadFile } from '~/native/download-file';
import { ImageSources } from '~/metro/common';
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

// UNKNOWN: packs applied by older clients stored the whole pack under `applied`, where the id is kept now.
function legacyAppliedId(stored: unknown): string | undefined {
	if (typeof stored !== 'object' || stored === null || !('manifest' in stored)) return;

	const { manifest } = stored;

	if (typeof manifest !== 'object' || manifest === null || !('id' in manifest)) return;

	return typeof manifest.id === 'string' ? manifest.id : undefined;
}

/**
 * @description Manages icon packs. A pack is a folder of image files mirroring Discord's asset tree;
 * the applied pack rewrites `Image` sources to the on-disk files. Single-select, like themes.
 */
export class Icons extends Addons<Plugin> {
	protected readonly selection = 'one';
	protected readonly fallback = defaultPack.manifest.id;
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
	 * @returns One entry per installed pack.
	 */
	listInstalled(): InstalledEntry[] {
		return super.listInstalled().filter((entry) => entry.id !== defaultPack.manifest.id);
	}

	initialize() {
		const legacy = legacyAppliedId(this.settings.get<unknown>('applied', null));

		if (legacy !== undefined) {
			this.settings.set('applied', legacy);
		}

		for (const pack of this.settings.get<IconPack[]>('packs', [defaultPack])) {
			this.load(pack.bundle, pack.manifest);
		}
	}

	protected handleBundle(): null {
		return null;
	}

	/**
	 * @description Shows the applied pack's icons, replacing the pack before. The built-in pack has no
	 * files, so applying it shows Discord's own icons. Twin of {@link unapply}.
	 * @param pack The applied pack.
	 * @returns Settles once every registered asset is stamped and images read from the pack.
	 */
	protected async apply(pack: Addon): Promise<void> {
		this.removePack();

		if (pack.id !== this.fallback) {
			await this.applyPack(pack.id);
		}

		refreshImages();
	}

	/**
	 * @description Shows Discord's own icons again. Twin of {@link apply}.
	 */
	protected unapply(): void {
		this.removePack();
		refreshImages();
	}

	/**
	 * @description Deletes a pack, forgetting it from the packs loaded at launch.
	 * @param entity The pack to delete, as its id or the entity itself.
	 */
	async delete(entity: AddonResolveable): Promise<void> {
		const id = typeof entity === 'string' ? entity : entity.id;
		const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);

		this.settings.set(
			'packs',
			packs.filter((p) => p.manifest.id !== id),
		);

		this.indexes.delete(id);
		await super.delete(entity);
	}

	/**
	 * @description Applies a pack: stamps every registered asset with its on-disk override path, then
	 * patches the source resolution of every `Image` render to swap numeric sources for the pack's files.
	 * Stamps are awaited before the patch installs, so no image renders against an un-stamped asset.
	 * Assets that register later are stamped as they register.
	 * @param id The pack id to apply.
	 */
	async applyPack(id: string) {
		const stamps: Array<Promise<void>> = [];
		const files = await this.readIndex(id);

		this.stopStamping();
		this.stopStamping = onAssetRegistered((asset) => void this.stampAsset(id, asset, files));

		for (let assetId = 1; ; assetId++) {
			const asset = getById(assetId);

			if (!asset) {
				break;
			}

			stamps.push(this.stampAsset(id, asset, files));
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
	 * @description Finds the file a pack draws an asset with, without applying the pack, so a picker can preview it.
	 * @param id The pack id; the built-in `default` pack has no files.
	 * @param asset The asset.
	 * @returns The highest-scale file the pack has for it, or `undefined` when it keeps Discord's.
	 */
	async findIconFile(id: string, asset: UnboundAsset): Promise<IconFile | undefined> {
		if (id === defaultPack.manifest.id) return;

		return this.lookupFile(id, asset, await this.readIndex(id));
	}

	// A pack with an index is checked in memory; one installed before indexes asks the disk per scale.
	private async lookupFile(
		id: string,
		asset: UnboundAsset,
		files: Set<string> | undefined,
	): Promise<IconFile | undefined> {
		const scales = [...asset.scales].sort((a, b) => b - a);

		for (const scale of scales) {
			const relative = this.relativeAssetPath(asset, scale);
			const path = `${this.directoryOf(id)}/${relative}`;
			const found = files ? files.has(relative) : await fs.exists(path);

			if (found) {
				return { path: `${fs.documentsPath}/${path}`, scale };
			}
		}

		return undefined;
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
	 */
	protected async stampAsset(id: string, asset: UnboundAsset, files: Set<string> | undefined) {
		delete asset.iconPackPath;
		delete asset.iconPackScale;

		const file = await this.lookupFile(id, asset, files);

		if (!file) {
			return;
		}

		asset.iconPackPath = file.path;
		asset.iconPackScale = file.scale;
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

			const packs = this.settings.get<IconPack[]>('packs', [defaultPack]);

			this.settings.set('packs', [
				...packs.filter((p) => p.manifest.id !== manifest.id),
				{ bundle: manifest.name, manifest },
			]);

			this.load(manifest.name, manifest);

			return this.installed(manifest.id, url);
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
