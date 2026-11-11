import type {
	NativeFabricBatchMutation,
	NativeFabricBridge,
	NativeFabricSize,
	NativeFabricSurface,
} from '@unbound-app/api/native';

type TooltipFabric = Pick<NativeFabricBridge, 'batchAsync' | 'setSizeAsync' | 'setFrameAsync'>;

// `fabric.batchAsync` arrived in native plugin API 1.2.0. A plugin's scope always has it, so only the version tells.
function batchesFrames(apiVersion: string): boolean {
	const [major = 0, minor = 0] = apiVersion.split('.').map(Number);

	return major > 1 || (major === 1 && minor >= 2);
}

/**
 * @description Sizes the tooltip surface and places it at its host's origin, in one frame batch when the loader has one.
 * @param fabric The Fabric bridge from `context.native`.
 * @param apiVersion The native plugin API version from `context.native`.
 * @param surface The mounted tooltip surface.
 * @param size The tooltip's size.
 */
export async function layoutTooltipSurface(
	fabric: TooltipFabric,
	apiVersion: string,
	surface: NativeFabricSurface,
	size: NativeFabricSize,
): Promise<void> {
	const frame = { x: 0, y: 0, ...size };

	if (!batchesFrames(apiVersion)) {
		await fabric.setSizeAsync(surface, size, size);
		await fabric.setFrameAsync(surface, frame);

		return;
	}

	const mutation: NativeFabricBatchMutation = {
		surface,
		size: { minimum: size, maximum: size },
		frame,
	};

	await fabric.batchAsync([mutation]);
}
