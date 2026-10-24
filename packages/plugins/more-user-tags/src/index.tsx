import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { createTagGradients } from '~/native/tag-gradient-renderer';
import { patchGetTagProperties } from '~/patches/get-tag-properties';
import { createLabelAppearances } from '~/label-appearances';
import SettingsPanel from '~/components/settings-panel';
import {
	ChannelStore,
	DiscordConstants,
	GuildStore,
	PermissionUtils,
	TagProperties,
} from '~/modules';

let dispose = () => {};
let settled = () => Promise.resolve();

function start(context: PluginContext) {
	const modules = { DiscordConstants, PermissionUtils, TagProperties, ChannelStore, GuildStore };

	if (!ensureModules('More User Tags', modules)) return;

	const appearances = createLabelAppearances();
	const gradients = createTagGradients(context, appearances);

	settled = gradients.settled;
	dispose = applyFeatures('More User Tags', [
		() => gradients.start(),
		() => patchGetTagProperties(context.platform, appearances),
	]);
}

function stop() {
	dispose();
	dispose = () => {};

	return settled();
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
