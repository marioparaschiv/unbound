import { BRIDGE_SERVICE_TYPE } from '@unbound-app/debugger-protocol';
import type { NativeUIBridge } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';

import {
	startDiscovery,
	stopDiscovery,
	type ResolvedService,
} from '~/debugger/discovery-android-worklets.dev';
import {
	pickAddress,
	toDiscoveredBridge,
	type DiscoveredBridge,
} from '~/debugger/bridge-service.dev';
import type { BrowseHandlers } from '~/debugger/discovery-ios.dev';

const Logger = createLogger('Debugger', 'Discovery');

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const TXT_KEYS = ['proto', 'by', 'code'];

/** The part of the UI-runtime bridge a browse uses. */
export type DiscoveryUI = Pick<NativeUIBridge, 'callback' | 'createScope' | 'run'>;

let nextBrowse = 0;

/**
 * @description Builds a discovered bridge from a service `NsdManager` resolved, dialing an IPv4 address since a
 * link-local IPv6 one needs a scope `ws://` cannot carry.
 * @param service The resolved service.
 * @returns The bridge, or `undefined` when it has no IPv4 address or is not a bridge of this protocol.
 */
export function describeService({
	computer,
	hosts,
	port,
	txt,
}: ResolvedService): DiscoveredBridge | undefined {
	const address = pickAddress(
		hosts.map((host) => (IPV4.test(host) ? `${host}:${port}` : undefined)),
	);

	return address ? toDiscoveredBridge(computer, address, txt) : undefined;
}

/**
 * @description Browses the local network for bridges with `NsdManager`, whose listeners are Java proxies answered on
 * the UI runtime.
 * @param ui The UI-runtime bridge, allowed Java classes, fields, invocation, construction and hooks.
 * @param handlers Called on the JS thread as bridges appear and disappear.
 * @returns Stops the browse and removes its listeners.
 */
export function browseAndroid(ui: DiscoveryUI, handlers: BrowseHandlers): () => void {
	const stateKey = `__unboundBridgeDiscovery:${nextBrowse++}`;
	let stopped = false;

	const found = ui.callback((service: ResolvedService) => {
		const bridge = stopped ? undefined : describeService(service);

		if (bridge) {
			handlers.found(bridge);
		}
	});
	const lost = ui.callback((computer: string) => {
		if (!stopped) {
			handlers.lost(computer);
		}
	});
	const failed = ui.callback((operation: string, subject: string, reason: string) => {
		Logger.warn(`Failed to ${operation} ${subject}:`, reason);
	});

	ui.run(
		startDiscovery,
		ui.createScope(),
		{ stateKey, serviceType: BRIDGE_SERVICE_TYPE, txtKeys: TXT_KEYS },
		found,
		lost,
		failed,
	);

	return () => {
		if (stopped) return;

		stopped = true;
		ui.run(stopDiscovery, stateKey);
	};
}
