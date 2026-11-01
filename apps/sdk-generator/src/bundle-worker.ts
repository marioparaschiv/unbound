import { bundle } from './bundle';

declare const self: Worker;

type BundleRequest = { id: number; source: string };

self.onmessage = (event: MessageEvent<BundleRequest>) => {
	const { id, source } = event.data;

	try {
		self.postMessage({ id, text: bundle(source) });
	} catch (error) {
		self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
	}
};
