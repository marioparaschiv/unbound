import type {
	NativeFabricBatchMutation,
	NativeFabricBridge,
	NativeFabricSize,
	NativeFabricSurface,
} from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

type TooltipFabric = Pick<NativeFabricBridge, 'batchAsync' | 'setSizeAsync' | 'setFrameAsync'>;

/**
 * @description Sizes the tooltip surface and places it at its host's origin, in one frame batch when the loader has one.
 * @param fabric The Fabric bridge from `context.native`.
 * @param surface The mounted tooltip surface.
 * @param size The tooltip's size.
 */
export async function layoutTooltipSurface(
	fabric: TooltipFabric,
	surface: NativeFabricSurface,
	size: NativeFabricSize,
): Promise<void> {
	const frame = { x: 0, y: 0, ...size };

	// A plugin's scope always has `batchAsync`; only the loader knows whether it is real. Clients before `native.supports` lack it.
	if (!native.supports?.('fabric.batchAsync')) {
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
