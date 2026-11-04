import { featureSelfTest, recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import {
	ChannelStore,
	DiscordConstants,
	GuildStore,
	PermissionUtils,
	TagProperties,
	bucket,
} from '~/tags/modules';
import { createLabelAppearances } from '~/tags/label-appearances';
import { clearTagProblems, tagProblems } from '~/tags/tag-problems';
import { patchTagProperties } from '~/tags/patch-tag-properties';
import { createTagGradients } from '~/tags/platform';

const APPEARANCE_CACHE_KEY = 'appearanceCache';
const SAVE_DELAY_MS = 1000;

let removeNative = () => {};
let settled = () => Promise.resolve();
let gradientProblems: () => Promise<string[]> = () => Promise.resolve([]);
let gradientsDrawn = () => 0;

/**
 * @description Adds a tag to the message headers of webhooks, owners and moderators, and draws its gradient natively.
 * Patches the default export of `getTagProperties`, and reads `Permissions` of Discord's constants, `computePermissions` of its permission utilities, and the Channel, Guild and GuildMember stores.
 * The Addon scope removes the patch, but not the native gradients or the pending save, so `stopTags` removes those.
 * @param context The native plugin context the gradient renderer draws with.
 */
export function startTags(context: PluginContext): void {
	const modules = { DiscordConstants, PermissionUtils, TagProperties, ChannelStore, GuildStore };

	if (!ensureModules('More User Tags', modules)) return;

	const appearances = createLabelAppearances();
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	appearances.restore(bucket.get(APPEARANCE_CACHE_KEY, {}));

	const stopSaving = appearances.subscribe(() => {
		saveTimer ??= setTimeout(() => {
			saveTimer = undefined;
			bucket.set(APPEARANCE_CACHE_KEY, appearances.snapshot());
		}, SAVE_DELAY_MS);
	});
	const gradients = createTagGradients(context, appearances);

	settled = gradients.settled;
	gradientProblems = gradients.problems;
	gradientsDrawn = gradients.drawn;

	patchTagProperties(appearances);

	const stopGradients = gradients.start();

	removeNative = () => {
		stopGradients();
		stopSaving();
		clearTimeout(saveTimer);
	};

	recordApplied(1);
}

/**
 * @description Removes the native gradients and cancels the pending save.
 * @returns A promise that settles once every gradient layer is gone.
 */
export function stopTags(): Promise<void> {
	clearTagProblems();
	removeNative();
	removeNative = () => {};

	return settled();
}

/**
 * @description Reports tags that look wrong, and whether the gradients on screen look right.
 * @returns Whether the plugin looks healthy, with a detail line.
 */
export async function tagsSelfTest() {
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
