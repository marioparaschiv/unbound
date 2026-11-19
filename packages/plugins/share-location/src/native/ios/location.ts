import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

import { readCoordinates, type Coordinates } from '~/lib/coordinates';

const DELEGATE_CLASS = 'UnboundShareLocationDelegate';
const AUTHORIZED = new Set([3, 4]);
const DENIED = new Set([1, 2]);
const TIMEOUT_MS = 20_000;

type Request = {
	resolve: (coordinates: Coordinates) => void;
	reject: (error: Error) => void;
	handles: NativeObjectHandle[];
};

let pending: Request | undefined;

function settle(result: Coordinates | Error, request = pending) {
	if (!request || request !== pending) return;

	pending = undefined;

	if (result instanceof Error) request.reject(result);
	else request.resolve(result);
}

/**
 * @description Asks iOS for the device's location once, requesting permission while in use when it was never asked.
 * @param bridge The plugin's native bridge.
 * @returns The coordinates, or rejects when permission is denied, location fails or nothing answers in time.
 */
export async function currentLocationIOS(bridge: NativeBridge): Promise<Coordinates> {
	const { objc } = bridge;
	const Delegate = objc.defineClass(
		DELEGATE_CLASS,
		'NSObject',
		{
			'locationManager:didUpdateLocations:': {
				signature: { returnType: 'void', args: ['object', 'object'] },
				implementation: (_self, _manager, locations: NativeObjectHandle) => {
					// UNKNOWN: the bridge hands the array over as a JS array or an `NSArray` handle.
					const list = (
						Array.isArray(locations) ? locations : objc.array(locations)
					) as NativeObjectHandle[];
					const last = list.at(-1);
					const coordinates = last
						? readCoordinates(String(objc.call(last, 'description')))
						: undefined;

					settle(coordinates ?? new Error('iOS gave no coordinates'));
				},
			},
			'locationManager:didFailWithError:': {
				signature: { returnType: 'void', args: ['object', 'object'] },
				implementation: (_self, _manager, error: NativeObjectHandle) => {
					settle(new Error(String(objc.call(error, 'localizedDescription'))));
				},
			},
			'locationManagerDidChangeAuthorization:': {
				signature: { returnType: 'void', args: ['object'] },
				implementation: (_self, manager: NativeObjectHandle) => {
					const status = Number(objc.call(manager, 'authorizationStatus'));

					if (AUTHORIZED.has(status))
						void objc.invokeAsync(manager, 'requestLocation', []);
					else if (DENIED.has(status)) settle(new Error('denied'));
				},
			},
		},
		['CLLocationManagerDelegate'],
	);

	settle(new Error('replaced by a newer request'));

	return new Promise<Coordinates>((resolve, reject) => {
		const request: Request = { resolve, reject, handles: [] };

		pending = request;
		setTimeout(() => settle(new Error('timeout'), request), TIMEOUT_MS);

		void (async () => {
			const delegate = objc.alloc(Delegate);
			const manager = (await objc.invokeAsync(
				objc.getClass('CLLocationManager')!,
				'new',
				[],
			)) as NativeObjectHandle;

			request.handles = [manager, delegate];
			await objc.invokeAsync(manager, 'setDelegate:', [delegate]);

			const status = Number(await objc.invokeAsync(manager, 'authorizationStatus', []));

			if (AUTHORIZED.has(status)) await objc.invokeAsync(manager, 'requestLocation', []);
			else if (DENIED.has(status)) settle(new Error('denied'), request);
			else await objc.invokeAsync(manager, 'requestWhenInUseAuthorization', []);
		})().catch((error: unknown) =>
			settle(error instanceof Error ? error : new Error(String(error)), request),
		);
	});
}

export default currentLocationIOS;
