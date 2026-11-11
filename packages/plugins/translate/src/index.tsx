import { patcher } from '@unbound-app/api';

import { patchActionSheets } from '~/patches/action-sheets';
import { patchMessageRows } from '~/patches/message-rows';
import { redrawOriginalText } from '~/lib/inline';

export { SettingsPanel } from '~/settings';

export function start() {
	patchActionSheets();
	patchMessageRows();
}

// The row patches must stay until Discord redrew the original text, so they are removed after it.
export async function stop() {
	await redrawOriginalText();
	patcher.unpatchAll();
}
