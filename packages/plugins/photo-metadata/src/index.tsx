import type { PluginContext } from '@unbound-app/api/native';

import { interceptAttachments } from '~/flux/interceptors';
import { createPhotoTools } from '~/native/photos';

export function start(context: PluginContext) {
	const tools = createPhotoTools(context.native);

	if (tools) interceptAttachments(tools, context.tempPath);
}
