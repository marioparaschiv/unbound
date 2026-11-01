import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ActionSheets, CloudUploader, EditMessageStore, REST } from '~/discord/modules';
import { interceptEditUploads } from '~/editing';
import { patchActionSheets } from '~/sheet';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	if (!ensureModules(PLUGIN_NAME, { ActionSheets, CloudUploader, EditMessageStore, REST }))
		return;

	dispose = applyFeatures(PLUGIN_NAME, [() => interceptEditUploads(), () => patchActionSheets()]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default { start, stop, selfTest: featureSelfTest };
