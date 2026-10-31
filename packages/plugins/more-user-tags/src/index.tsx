import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { patchGetTagProperties } from '~/patches/get-tag-properties';
import { createLabelAppearances } from '~/label-appearances';
import { clearTagProblems, tagProblems } from '~/tag-problems';
import SettingsPanel from '~/components/settings-panel';
import { createTagGradients } from '~/platform';
import {
	ChannelStore,
	DiscordConstants,
	GuildStore,
	PermissionUtils,
	TagProperties,
} from '~/modules';

let dispose = () => {};
let settled = () => Promise.resolve();
let gradientProblems: () => Promise<string[]> = () => Promise.resolve([]);
let gradientsDrawn = () => 0;

function start(context: PluginContext) {
	const modules = { DiscordConstants, PermissionUtils, TagProperties, ChannelStore, GuildStore };

	if (!ensureModules('More User Tags', modules)) return;

	const appearances = createLabelAppearances();
	const gradients = createTagGradients(context, appearances);

	settled = gradients.settled;
	gradientProblems = gradients.problems;
	gradientsDrawn = gradients.drawn;
	dispose = applyFeatures('More User Tags', [
		() => gradients.start(),
		() => patchGetTagProperties(appearances),
	]);
}

function stop() {
	clearTagProblems();
	dispose();
	dispose = () => {};

	return settled();
}

async function selfTest() {
	const problems = [...tagProblems(), ...(await gradientProblems())];

	if (problems.length) {
		return {
			ok: false,
			detail: `${problems.length} tags look wrong: ${problems.slice(0, 3).join('; ')}`,
		};
	}

	const features = featureSelfTest();
	const drawn = gradientsDrawn();

	return drawn && features.ok
		? { ...features, detail: `${features.detail}, ${drawn} tag gradients look right` }
		: features;
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
