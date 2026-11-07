import type {
	NativeFabricBatchMutation,
	NativeFabricBridge,
	NativeFabricSize,
	NativeFabricSurface,
} from '@unbound-app/api/native';

export function layoutTooltipSurface(
	fabric: Pick<NativeFabricBridge, 'batchAsync'>,
	surface: NativeFabricSurface,
	size: NativeFabricSize,
): Promise<void> {
	const mutation: NativeFabricBatchMutation = {
		surface,
		size: { minimum: size, maximum: size },
		frame: { x: 0, y: 0, ...size },
	};

	return fabric.batchAsync([mutation]);
}
