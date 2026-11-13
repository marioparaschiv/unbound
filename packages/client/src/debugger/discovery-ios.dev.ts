import type { LoaderObjCBridge, NativeObjCResult, NativeObjectHandle } from '@unbound-app/types';
import { BRIDGE_SERVICE_TYPE } from '@unbound-app/debugger-protocol';
import { createLogger } from '@unbound-app/logger';

import {
	pickAddress,
	readSocketAddress,
	readTxtRecord,
	toDiscoveredBridge,
	type DiscoveredBridge,
} from '~/debugger/bridge-service.dev';
import { asNumber, asText } from '~/debugger/objc-values.dev';

/** What a browse reports: a bridge that resolved, and the computer name of one that went away. */
export type BrowseHandlers = {
	found: (bridge: DiscoveredBridge) => void;
	lost: (computer: string) => void;
};

const Logger = createLogger('Debugger', 'Discovery');

const DELEGATE_CLASS = 'UnboundBridgeBrowserDelegate';
const RESOLVE_TIMEOUT_SECONDS = 5;

function asBytes(value: NativeObjCResult): Uint8Array {
	return value instanceof Uint8Array ? value : new Uint8Array();
}

/**
 * @description Browses the local network for bridges with `NSNetServiceBrowser`, resolving each to an address. The
 * app must list the service type in `NSBonjourServices`, or iOS refuses the search.
 * @param objc The loader's unscoped Objective-C bridge.
 * @param handlers Called on the JS thread as bridges appear and disappear.
 * @returns Stops the browse and every pending resolve.
 */
export function browseIos(objc: LoaderObjCBridge, handlers: BrowseHandlers): () => void {
	// Held until they resolve or vanish: the browser hands services over without retaining them for us.
	const services = new Map<string, NativeObjectHandle>();

	function describe(service: NativeObjectHandle): DiscoveredBridge | undefined {
		const computer = asText(objc.call(service, 'name'));
		const addresses = objc.call(service, 'addresses');
		const ipv4 = Array.isArray(addresses)
			? pickAddress(addresses.map((address) => readSocketAddress(asBytes(address))))
			: undefined;
		const host = asText(objc.call(service, 'hostName')).replace(/\.$/, '');
		const address = ipv4 ?? (host && `${host}:${asNumber(objc.call(service, 'port')) ?? 0}`);

		if (!address) return;

		return toDiscoveredBridge(
			computer,
			address,
			readTxtRecord(asBytes(objc.call(service, 'TXTRecordData'))),
		);
	}

	const delegateClass = objc.defineClass(
		DELEGATE_CLASS,
		'NSObject',
		{
			'netServiceBrowser:didFindService:moreComing:': {
				signature: { returnType: 'void', args: ['object', 'object', 'bool'] },
				implementation: (
					_self,
					_browser: NativeObjectHandle,
					service: NativeObjectHandle,
				) => {
					services.set(asText(objc.call(service, 'name')), service);
					objc.invoke(service, 'setDelegate:', [delegate], { thread: 'main-post' });
					objc.invoke(service, 'resolveWithTimeout:', [RESOLVE_TIMEOUT_SECONDS], {
						thread: 'main-post',
					});
				},
			},
			'netServiceBrowser:didRemoveService:moreComing:': {
				signature: { returnType: 'void', args: ['object', 'object', 'bool'] },
				implementation: (
					_self,
					_browser: NativeObjectHandle,
					service: NativeObjectHandle,
				) => {
					const computer = asText(objc.call(service, 'name'));

					services.delete(computer);
					handlers.lost(computer);
				},
			},
			'netServiceBrowser:didNotSearch:': {
				signature: { returnType: 'void', args: ['object', 'object'] },
				implementation: (_self, _browser: NativeObjectHandle, errors: NativeObjCResult) => {
					Logger.error(`Failed to browse for ${BRIDGE_SERVICE_TYPE}:`, errors);
				},
			},
			'netServiceDidResolveAddress:': {
				signature: { returnType: 'void', args: ['object'] },
				implementation: (_self, service: NativeObjectHandle) => {
					const bridge = describe(service);

					if (bridge) {
						handlers.found(bridge);
					}
				},
			},
			'netService:didNotResolve:': {
				signature: { returnType: 'void', args: ['object', 'object'] },
				implementation: (_self, service: NativeObjectHandle, errors: NativeObjCResult) => {
					Logger.warn(
						`Failed to resolve bridge ${asText(objc.call(service, 'name'))}:`,
						errors,
					);
				},
			},
		},
		['NSNetServiceBrowserDelegate', 'NSNetServiceDelegate'],
	);
	const delegate = objc.alloc(delegateClass);
	const browser = objc.alloc('NSNetServiceBrowser');

	// The browser and its services report on the run loop they were scheduled from, so start them on main's.
	objc.invoke(browser, 'setDelegate:', [delegate], { thread: 'main-post' });
	objc.invoke(
		browser,
		'searchForServicesOfType:inDomain:',
		[`${BRIDGE_SERVICE_TYPE}.`, 'local.'],
		{
			thread: 'main-post',
		},
	);

	return () => {
		objc.invoke(browser, 'stop', [], { thread: 'main-post' });
		objc.invoke(browser, 'setDelegate:', [null], { thread: 'main-post' });

		for (const service of services.values()) {
			objc.invoke(service, 'stop', [], { thread: 'main-post' });
			objc.invoke(service, 'setDelegate:', [null], { thread: 'main-post' });
		}

		services.clear();
	};
}
