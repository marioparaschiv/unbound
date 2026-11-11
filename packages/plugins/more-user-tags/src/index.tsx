import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { drawTagGradients, eraseTagGradients, selfTestTags } from '~/native/views';
import { startSavingAppearances, stopSavingAppearances } from '~/lib/appearance-cache';
import { clearTagProblems } from '~/lib/tag-problems';
import { patchTagProperties } from '~/patches';

export function start(context: PluginContext) {
	startSavingAppearances();
	patchTagProperties();
	drawTagGradients(context);
}

export async function stop() {
	patcher.unpatchAll();
	clearTagProblems();
	stopSavingAppearances();
	await eraseTagGradients();
}

export function selfTest() {
	return selfTestTags();
}
