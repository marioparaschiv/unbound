import { failExplorerRequest, serializeMessage } from '@unbound-app/debugger-protocol';
import type { ExplorerRequest, ExplorerResult } from '@unbound-app/debugger-protocol';
import { PendingRequests } from '@unbound-app/debugger-protocol/pending-requests';

import type { SocketLike } from './session';

/**
 * The bridge's routing for object explorer frames: each request goes to the device and its answer back to the
 * controller that asked, as `session.ts` routes view details.
 */

const EXPLORER_TIMEOUT_MS = 15_000;

/** The controller that asked and the request's type, so a failure answers with the matching result. */
type PendingOrigin = { socket: SocketLike; type: ExplorerRequest['type'] };

const pendingExplorer = new PendingRequests<ExplorerResult, PendingOrigin>();

/**
 * @description Forwards a controller's explorer request to the device and delivers the id-correlated result back
 * over that same controller's socket, or a `failed` answer when no device answers.
 * @param device The connected device, if any.
 * @param socket The controller that asked.
 * @param request The request to forward verbatim; its `id` correlates the result.
 */
export function requestExplorer(
	device: SocketLike | null,
	socket: SocketLike,
	request: ExplorerRequest,
) {
	const deliver = (result: ExplorerResult) => socket.send(serializeMessage(result));

	if (!device) {
		deliver(failExplorerRequest(request, 'No device is connected to the debugger.', 'failed'));

		return;
	}

	pendingExplorer.add(request.id, {
		settle: deliver,
		timeoutMs: EXPLORER_TIMEOUT_MS,
		onTimeout: () =>
			failExplorerRequest(
				request,
				`Exploring timed out after ${EXPLORER_TIMEOUT_MS}ms.`,
				'failed',
			),
		meta: { socket, type: request.type },
	});
	device.send(serializeMessage(request));
}

/**
 * @description Settles the pending request a device's explorer result answers.
 * @param result The device's answer.
 */
export function settleExplorer(result: ExplorerResult) {
	pendingExplorer.resolve(result.id, result);
}

/** @description Fails every in-flight explorer request, when the device drops. */
export function failExplorer() {
	pendingExplorer.failAll((id, { type }) =>
		failExplorerRequest(
			{ type, id },
			'Device disconnected before the explorer answered.',
			'failed',
		),
	);
}

/**
 * @description Drops a controller's in-flight explorer requests, when it leaves.
 * @param socket The controller that closed.
 */
export function discardExplorer(socket: SocketLike) {
	pendingExplorer.discard((origin) => origin.socket === socket);
}
