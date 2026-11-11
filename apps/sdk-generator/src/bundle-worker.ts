import type { BundleReply, BundleRequest } from './bundle-pool';

import { bundle } from './bundle';

declare const self: Worker;

function reply(message: BundleReply) {
	self.postMessage(message);
}

self.onmessage = (event: MessageEvent<BundleRequest>) => {
	const { id, source } = event.data;

	try {
		reply({ id, text: bundle(source) });
	} catch (error) {
		reply({ id, error: error instanceof Error ? error.message : String(error) });
	}
};
