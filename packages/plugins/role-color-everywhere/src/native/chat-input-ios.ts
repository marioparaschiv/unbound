import { getRoleColorAppearance, roleColorRuns } from '@unbound-plugins/shared/colors/role-colors';
import findVisibleCells from '@unbound-plugins/shared/native/ios/visible-cells';
import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type { NativeBridge } from '@unbound-app/api/native';

import {
	installComposerHooks,
	restoreComposer,
	setComposerMentions,
	type ComposerMentions,
} from '~/native/ui-chat-input-ios';
import { GuildMemberStore, SelectedChannelStore } from '~/lib/modules';
import { currentGuildId, guildAliases } from '~/lib/composer-aliases';

const REFRESH_DELAY_MS = 250;

/** The Discord class whose text {@link colorChatInputMentions} paints. */
export const CHAT_INPUT_CLASS = 'DCDChatInputComponentView';

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
export function colorChatInputMentions(native: NativeBridge): () => Promise<void> {
	const { objc, ui } = native;
	if (!ensureClasses(objc, [CHAT_INPUT_CLASS], 'Composer mentions')) {
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
				logger.error(`Failed to scan the composer:`, error);
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
