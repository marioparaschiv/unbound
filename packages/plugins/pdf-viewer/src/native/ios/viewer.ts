import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { PdfViewer } from '~/native/viewer';

const SOURCE_CLASS = 'UnboundPDFViewerSource';

async function topViewController(objc: NativeBridge['objc']): Promise<NativeObjectHandle | null> {
	const UIApplication = objc.getClass('UIApplication');
	const app = UIApplication
		? (objc.call(UIApplication, 'sharedApplication') as NativeObjectHandle)
		: null;
	const window = app
		? ((await objc.invokeAsync(app, 'keyWindow', [])) as NativeObjectHandle | null)
		: null;
	let top = window
		? ((await objc.invokeAsync(window, 'rootViewController', [])) as NativeObjectHandle | null)
		: null;

	for (let depth = 0; top && depth < 10; depth++) {
		const next = (await objc.invokeAsync(
			top,
			'presentedViewController',
			[],
		)) as NativeObjectHandle | null;

		if (!next) break;

		top = next;
	}

	return top;
}

/**
 * @description Opens PDFs in Quick Look, iOS's viewer, which has page thumbnails, search, markup and sharing.
 * @param native The plugin's native bridge.
 * @returns The viewer.
 */
export function createViewer(native: NativeBridge): PdfViewer {
	const { objc } = native;
	let item: NativeObjectHandle | null = null;
	let source: NativeObjectHandle | null = null;

	return {
		async open(path) {
			const NSURL = objc.getClass('NSURL');
			const QLPreviewController = objc.getClass('QLPreviewController');

			if (!NSURL || !QLPreviewController) throw new Error('Quick Look is unavailable');

			item = objc.call(NSURL, 'fileURLWithPath:', path) as NativeObjectHandle;

			const Source = objc.defineClass(
				SOURCE_CLASS,
				'NSObject',
				{
					'numberOfPreviewItemsInPreviewController:': {
						signature: { returnType: 'i64', args: ['object'] },
						implementation: () => (item ? 1 : 0),
					},
					'previewController:previewItemAtIndex:': {
						signature: { returnType: 'object', args: ['object', 'i64'] },
						implementation: () => item,
					},
				},
				['QLPreviewControllerDataSource'],
			);

			source = objc.call(Source, 'new') as NativeObjectHandle;

			const controller = objc.call(QLPreviewController, 'new') as NativeObjectHandle;
			const top = await topViewController(objc);

			if (!top) throw new Error('no view controller to present from');

			await objc.invokeAsync(controller, 'setDataSource:', [source]);
			await objc.invokeAsync(top, 'presentViewController:animated:completion:', [
				controller,
				true,
				null,
			]);
		},
		dispose() {
			item = null;
			source = null;
		},
	};
}

export default { createViewer };
