import type { NativeNetworkState } from '@unbound-app/types/native-platform';

const UNMETERED_TYPES = new Set<NativeNetworkState['type']>(['wifi', 'ethernet']);

/**
 * @description Says whether Discord is on Wi-Fi or ethernet with no data limit, for jobs that only run there.
 * @param network The connection; read from the loader by default, which older loaders do not report.
 * @returns Whether the connection is unmetered; `true` when the loader cannot tell, so older loaders run every job.
 */
export function onUnmeteredNetwork(
	network: NativeNetworkState | undefined = globalThis.NativePlatform?.device.getState?.()
		?.network,
): boolean {
	if (!network) {
		return true;
	}

	return UNMETERED_TYPES.has(network.type) && !network.metered && !network.lowData;
}

export default { onUnmeteredNetwork };
