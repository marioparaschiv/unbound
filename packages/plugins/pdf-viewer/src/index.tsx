import type { PluginContext } from '@unbound-app/api/native';

import { createPdfViewer, type PdfViewer } from '~/native/viewer';
import { patchAttachmentTaps } from '~/patches';

let viewer: PdfViewer | undefined;

export function start(context: PluginContext) {
	viewer = createPdfViewer(context.native);

	if (viewer) patchAttachmentTaps(viewer, context.tempPath);
}

export function stop() {
	viewer?.dispose();
	viewer = undefined;
}
