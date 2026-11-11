import { patcher } from '@unbound-app/api';

import { interceptUploadAddFiles } from '~/flux/interceptors';
import { patchMessageLongPressSheet } from '~/patches';

export function start() {
	interceptUploadAddFiles();
	patchMessageLongPressSheet();
}

export function stop() {
	patcher.unpatchAll();
}
