import type { AssetsModule, UnboundAsset } from '@unbound-app/types/assets';
import { getAssetPath } from '@unbound-app/contracts/addon-assets';
import type { AddonAsset } from '@unbound-app/types/addons';

import { find as findModule, findByProps } from '~/metro/lookups';
import { recordedAssets as assets } from '~/assets/registered';
import { byProps } from '~/metro/filters';

/** An image to register with Discord's asset registry, so `<Image source={id}>` and Discord's icon props draw it. */
export type AssetRegistration = {
	/** The asset's name; a plugin's names are kept apart from every other plugin's. */
	name: string;
	/** The image's URI at scale 1, such as a `data:` or `file://` URI. */
	uri?: string;
	/** The image file at scale 1, as an absolute path such as `${fs.documentsPath}/MyPlugin/star.png`. */
	path?: string;
	/** Width in points. */
	width: number;
	/** Height in points. */
	height: number;
	/** The file type, such as `png`. */
	type: string;
	/** The image at other pixel densities, as URIs or absolute paths by scale, such as `{ 2: '/…/star@2x.png' }`. */
	scales?: Record<number, string>;
};

/** A registered asset: its id, and the function that takes it out of the registry. */
export type RegisteredAsset = {
	/** The asset registry id, which an image `source` or an `icon` option takes. */
	id: number;
	/** Takes the asset out of the registry; registering its name again reuses the id. */
	unregister: () => void;
};

type Resolver = { asset?: UnboundAsset };

type ResolvedSource = {
	__packager_asset: boolean;
	width: number;
	height: number;
	uri: string;
	scale: number;
};

type SourceResolver = {
	addCustomSourceTransformer: (transform: (resolver: Resolver) => ResolvedSource | null) => void;
	pickScale: (scales: number[], deviceScale: number) => number;
};

type Registration = {
	id: number;
	owner: string | undefined;
	name: string;
	type: string;
	// The live registration's handle; `undefined` once it was unregistered.
	token: symbol | undefined;
};

// React Native's `resolveAssetSource`, whose transformers run before it builds a path inside the app bundle.
const SourceResolver: SourceResolver | undefined = findByProps(
	'addCustomSourceTransformer',
	'pickScale',
);

// Every registration by `<qualified name>.<type>`; an unregistered one keeps its id for the next registration.
const registrations = new Map<string, Registration>();
const unregistered = new Set<number>();

let transforming = false;

function qualify(owner: string | undefined, name: string) {
	return owner ? `${owner}/${name}` : name;
}

function toUri(source: string) {
	if (/^[a-z][\w+.-]*:/i.test(source)) {
		return source;
	}

	if (!source.startsWith('/')) {
		throw new Error(
			`Asset path ${source} must be absolute, such as \`\${fs.documentsPath}/…\`.`,
		);
	}

	return `file://${source}`;
}

function sourcesOf(options: AssetRegistration): Record<number, string> {
	const sources: Record<number, string> = {};
	const base = options.uri ?? options.path;

	if (base) {
		sources[1] = toUri(base);
	}

	for (const [scale, source] of Object.entries(options.scales ?? {})) {
		sources[Number(scale)] = toUri(source);
	}

	if (!Object.keys(sources).length) {
		throw new Error(`Asset ${options.name} needs a uri, a path or scales.`);
	}

	return sources;
}

function transform(resolver: Resolver): ResolvedSource | null {
	const asset = resolver.asset;
	const sources = asset?.unboundSources;

	if (!asset || !sources || !SourceResolver) return null;

	const scales = Object.keys(sources).map(Number);
	const scale = SourceResolver.pickScale(scales, window.ReactNative.PixelRatio.get());

	return {
		__packager_asset: true,
		width: asset.width,
		height: asset.height,
		uri: sources[scale],
		scale,
	};
}

function registry(): AssetsModule {
	const found: AssetsModule | undefined = findModule(byProps('registerAsset', 'getAssetByID'), {
		lazy: false,
	});

	if (!found) {
		throw new Error("Discord's asset registry has not loaded.");
	}

	if (!SourceResolver) {
		throw new Error("Discord's asset source resolver is missing.");
	}

	if (!transforming) {
		SourceResolver.addCustomSourceTransformer(transform);
		transforming = true;
	}

	return found;
}

/**
 * @description Registers an image with Discord's asset registry. Registering a name again reuses its id, so a
 * restarted plugin's images keep theirs.
 * @param owner The plugin that owns the asset, whose id prefixes its name; `undefined` keeps the name as given.
 * @param options The image.
 * @returns The asset's id, and the function that unregisters it.
 */
export function registerOwnedAsset(
	owner: string | undefined,
	options: AssetRegistration,
): RegisteredAsset {
	const target = registry();
	const name = qualify(owner, options.name);
	const key = `${name}.${options.type}`;
	const known = registrations.get(key);
	const fields: UnboundAsset = {
		__packager_asset: false,
		httpServerLocation: `/assets/unbound/${owner ?? 'runtime'}`,
		name,
		type: options.type,
		width: options.width,
		height: options.height,
		hash: '',
		unboundSources: sourcesOf(options),
		scales: [],
	};

	fields.scales = Object.keys(fields.unboundSources ?? {}).map(Number);

	let id: number;

	if (known) {
		id = known.id;
		// The registry keeps the object it was given, so updating it updates every lookup of the id.
		assets.set(id, Object.assign(target.getAssetByID(id) ?? {}, fields));
		unregistered.delete(id);
	} else {
		id = target.registerAsset(fields);
	}

	const token = Symbol(key);

	registrations.set(key, { id, owner, name: options.name, type: options.type, token });

	return {
		id,
		unregister() {
			const current = registrations.get(key);

			if (current?.token !== token) return;

			registrations.set(key, { ...current, token: undefined });
			unregistered.add(id);
			assets.delete(id);
			const asset: UnboundAsset | null = target.getAssetByID(id);

			delete asset?.unboundSources;
		},
	};
}

/**
 * @description Whether an asset id belongs to an asset that was unregistered and not registered again.
 * @param id The asset id.
 * @returns `true` when the id no longer draws anything.
 */
export function isUnregistered(id: number): boolean {
	return unregistered.has(id);
}

/**
 * @description Looks up the id of an asset a plugin registered under its own name.
 * @param owner The plugin's id.
 * @param name The name the plugin registered.
 * @param type The file type; any type matches when omitted.
 * @returns The id, or `undefined` when the plugin has no such live asset.
 */
export function findOwnedId(owner: string, name: string, type?: string): number | undefined {
	for (const registration of registrations.values()) {
		if (
			registration.token &&
			registration.owner === owner &&
			registration.name === name &&
			(!type || registration.type === type)
		) {
			return registration.id;
		}
	}

	return undefined;
}

/**
 * @description Turns a manifest's assets into registrations of the files installed beside the bundle.
 * @param directory The plugin's folder, as an absolute path.
 * @param main The manifest's `main`.
 * @param listed The manifest's `assets`.
 * @returns One registration per asset.
 */
export function manifestRegistrations(
	directory: string,
	main: string,
	listed: Record<string, AddonAsset>,
): AssetRegistration[] {
	return Object.entries(listed).map(([name, asset]) => {
		const scales: Record<number, string> = {};

		for (const [scale, sha256] of Object.entries(asset.scales)) {
			if (sha256) {
				scales[Number(scale)] = `${directory}/${getAssetPath(main, sha256, asset.type)}`;
			}
		}

		return { name, type: asset.type, width: asset.width, height: asset.height, scales };
	});
}
