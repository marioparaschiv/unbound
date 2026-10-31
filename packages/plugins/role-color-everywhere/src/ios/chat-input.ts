import { getRoleColorAppearance, roleColorRuns } from '@unbound-plugins/shared/colors/role-colors';
import findVisibleCells from '@unbound-plugins/shared/native/ios/visible-cells';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type { NativePluginBridge } from '@unbound-app/api/native';

import {
	installComposerHooks,
	restoreComposer,
	setComposerMentions,
	type ComposerMentions,
} from '~/ios/ui-chat-input';
import { ChannelStore, GuildMemberStore, SelectedChannelStore, UserStore } from '~/modules';
import { currentGuildId, guildAliases } from '~/composer-aliases';
import { PLUGIN_NAME } from '~/constants';

const REFRESH_DELAY_MS = 250;

function composerMentions(): ComposerMentions {
	const guildId = currentGuildId();

	if (!guildId) {
		return { names: [], runs: {} };
	}

	const { names, owners } = guildAliases(guildId);
	const runs: ComposerMentions['runs'] = {};

	for (const name of names) {
		const userId = owners.get(name);
		const member = userId ? GuildMemberStore.getMember(guildId, userId) : null;
		const { colors } = getRoleColorAppearance(member?.colorStrings, member?.colorString);

		if (colors.length) {
			runs[name] = roleColorRuns(`@${name}`, colors).map((run) => ({
				length: run.text.length,
				color: run.color,
			}));
		}
	}

	return { names: names.filter((name) => name in runs), runs };
}

/**
 * @description Paints mentions typed in the native chat input with the mentioned member's role colors, from UI-thread hooks fed with the current guild's colored names.
 * @param native The plugin's native bridge.
 * @returns A function that removes the hooks and restores the input's text and selection.
 */
export function colorChatInputMentions(native: NativePluginBridge): () => Promise<void> {
	const { objc, ui } = native;
	const feature = `${PLUGIN_NAME}: composer mentions`;

	if (
		!ensureModules(feature, { UserStore, ChannelStore, SelectedChannelStore }) ||
		!ensureClasses(feature, objc, ['DCDChatInputComponentView'])
	) {
		return async () => {};
	}

	const scope = ui.createScope();
	let timer: ReturnType<typeof setTimeout> | undefined;

	function refresh() {
		timer = undefined;
		ui.run(setComposerMentions, composerMentions());
	}

	function scheduleRefresh() {
		timer ??= setTimeout(refresh, REFRESH_DELAY_MS);
	}

	ui.run(installComposerHooks, scope, composerMentions());
	SelectedChannelStore.addChangeListener(scheduleRefresh);
	GuildMemberStore.addChangeListener(scheduleRefresh);

	void findVisibleCells(objc, 'DCDChatInputComponentView')
		.then((views) =>
			Promise.all(views.map((view) => objc.invokeAsync(view, 'setNeedsLayout', []))),
		)
		.catch((error) => {
			if (!isCancellation(error)) {
				console.error(`[${PLUGIN_NAME}] Failed to scan the composer:`, error);
			}
		});

	return async () => {
		SelectedChannelStore.removeChangeListener(scheduleRefresh);
		GuildMemberStore.removeChangeListener(scheduleRefresh);
		clearTimeout(timer);
		ui.run(restoreComposer);
		scope.dispose();
	};
}

export default colorChatInputMentions;
