import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { patchUploadPreviewSheet } from '~/patches/upload-preview-sheet';
import SettingsPanel from '~/components/settings-panel';
import { patchCloudUpload } from '~/patches/cloud-upload';
import { patchMessages } from '~/patches/messages';
import { createUploadChoices } from '~/uploads';
import { currentSettings } from '~/modules';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	const choices = createUploadChoices(currentSettings);

	dispose = applyFeatures(PLUGIN_NAME, [
		() => choices.clear,
		() => patchCloudUpload(choices),
		() => patchMessages(choices),
		() => patchUploadPreviewSheet(choices),
	]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
