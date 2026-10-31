import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeUIBridge,
} from '@unbound-app/api/native';
import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import { androidColor } from '@unbound-plugins/shared/colors/android-colors';

import {
	installAndroidComposerHooks,
	restoreAndroidComposer,
	setAndroidComposerMentions,
	type AndroidComposerMentions,
} from '~/android/ui-chat-input';
import { currentGuildId, guildAliases } from '~/composer-aliases';
import { GuildMemberStore, SelectedChannelStore } from '~/modules';
import { PLUGIN_NAME } from '~/constants';

const REFRESH_DELAY_MS = 250;

type Native = { java: NativeJavaBridge; hooks: NativeJavaHooksBridge; ui: NativeUIBridge };

function composerMentions(): AndroidComposerMentions {
	const guildId = currentGuildId();

	if (!guildId) {
		return { names: [], colors: {} };
	}

	const { names, owners } = guildAliases(guildId);
	const colors: AndroidComposerMentions['colors'] = {};

	for (const name of names) {
		const userId = owners.get(name);
		const member = userId ? GuildMemberStore.getMember(guildId, userId) : null;
		const [hex] = getRoleColorAppearance(member?.colorStrings, member?.colorString).colors;

		if (hex) {
			colors[name] = androidColor(hex);
		}
	}

	return { names: names.filter((name) => name in colors), colors };
}

/**
 * @description Paints mentions typed in Discord's native Android chat input with the mentioned member's role color, by recoloring the mention span Discord puts on each `@name` from UI-thread hooks.
 * @param native The plugin's native bridge.
 * @returns A function that removes the hooks and gives every recolored span its color back.
 */
export function colorAndroidChatInputMentions({ ui }: Native): () => Promise<void> {
	const scope = ui.createScope();
	let timer: ReturnType<typeof setTimeout> | undefined;

	function refresh() {
		timer = undefined;
		ui.run(setAndroidComposerMentions, composerMentions());
	}

	function scheduleRefresh() {
		timer ??= setTimeout(refresh, REFRESH_DELAY_MS);
	}

	ui.call(installAndroidComposerHooks, scope, composerMentions())
		.then((installed) => {
			if (!installed) {
				console.error(
					`[${PLUGIN_NAME}: composer mentions] Skipped, the mention span was not found.`,
				);
			}
		})
		.catch((error) => {
			console.error(`[${PLUGIN_NAME}: composer mentions] Failed to hook the input:`, error);
		});
	SelectedChannelStore.addChangeListener(scheduleRefresh);
	GuildMemberStore.addChangeListener(scheduleRefresh);

	return async () => {
		SelectedChannelStore.removeChangeListener(scheduleRefresh);
		GuildMemberStore.removeChangeListener(scheduleRefresh);
		clearTimeout(timer);
		ui.run(restoreAndroidComposer);
		scope.dispose();
	};
}

export default colorAndroidChatInputMentions;
