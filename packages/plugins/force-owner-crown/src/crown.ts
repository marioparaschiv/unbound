type ResolvedAsset = { uri?: unknown } | null | undefined;

export function resolveCrownSource(
	id: number,
	resolveAssetSource: (id: number) => ResolvedAsset,
	getAssetUri: (id: number) => unknown,
): string | number {
	const assetUri = getAssetUri(id);
	if (typeof assetUri === 'string' && assetUri.length > 0) return assetUri;

	const resolved = resolveAssetSource(id);
	if (typeof resolved?.uri === 'string' && resolved.uri.length > 0) return resolved.uri;

	return id;
}
