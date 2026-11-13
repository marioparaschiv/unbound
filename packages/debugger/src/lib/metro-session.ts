import { failMetroRequest, serializeMessage } from '@unbound-app/debugger-protocol';
import type { MetroRequest, MetroResult } from '@unbound-app/debugger-protocol';
import { PendingRequests } from '@unbound-app/debugger-protocol/pending-requests';

import type { SocketLike } from './session';

/**
 * The bridge's routing for Metro explorer frames: each request goes to the device and its answer back to the
 * controller that asked, as `explorer-session.ts` routes the object explorer's.
 */

const METRO_TIMEOUT_MS = 15_000;

/** The controller that asked and the request's type, so a failure answers with the matching result. */
type PendingOrigin = { socket: SocketLike; type: MetroRequest['type'] };

const pendingMetro = new PendingRequests<MetroResult, PendingOrigin>();

/**
 * @description Forwards a controller's Metro request to the device and delivers the id-correlated result back
 * over that same controller's socket, or a `failed` answer when no device answers.
 * @param device The connected device, if any.
 * @param socket The controller that asked.
 * @param request The request to forward verbatim; its `id` correlates the result.
 */
export function requestMetro(device: SocketLike | null, socket: SocketLike, request: MetroRequest) {
	const deliver = (result: MetroResult) => socket.send(serializeMessage(result));

	if (!device) {
		deliver(failMetroRequest(request, 'No device is connected to the debugger.', 'failed'));

		return;
	}

	pendingMetro.add(request.id, {
		settle: deliver,
		timeoutMs: METRO_TIMEOUT_MS,
		onTimeout: () =>
			failMetroRequest(request, `Metro timed out after ${METRO_TIMEOUT_MS}ms.`, 'failed'),
		meta: { socket, type: request.type },
	});
	device.send(serializeMessage(request));
}

/**
 * @description Settles the pending request a device's Metro result answers.
 * @param result The device's answer.
 */
export function settleMetro(result: MetroResult) {
	pendingMetro.resolve(result.id, result);
}

/** @description Fails every in-flight Metro request, when the device drops. */
export function failMetro() {
	pendingMetro.failAll((id, { type }) =>
		failMetroRequest({ type, id }, 'Device disconnected before Metro answered.', 'failed'),
	);
}

/**
 * @description Drops a controller's in-flight Metro requests, when it leaves.
 * @param socket The controller that closed.
 */
export function discardMetro(socket: SocketLike) {
	pendingMetro.discard((origin) => origin.socket === socket);
}
