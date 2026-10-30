import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { createTagGradients } from '~/native/tag-gradient-renderer';
import { patchGetTagProperties } from '~/patches/get-tag-properties';
import { createLabelAppearances } from '~/label-appearances';
import { clearTagProblems, tagProblems } from '~/tag-problems';
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
	clearTagProblems();
	dispose();
	dispose = () => {};

	return settled();
}

function selfTest() {
	const problems = tagProblems();

	if (problems.length) {
		return {
			ok: false,
			detail: `${problems.length} tags look wrong: ${problems.slice(0, 3).join('; ')}`,
		};
	}

	return featureSelfTest();
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
