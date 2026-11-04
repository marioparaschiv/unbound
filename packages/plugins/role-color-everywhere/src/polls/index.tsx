import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';
import { cloneElement } from 'react';

import { ChannelStore, GuildMemberStore, PollVotesActionSheet } from '~/polls/modules';
import RoleColoredVotersList from '~/polls/voters-list';
import { guildIdOf } from '~/shared/channel-guild';
import { PLUGIN_NAME } from '~/constants';
import type { Rendered } from '~/types';

function patchPollVotesActionSheet(): () => void {
	return patcher.react.after(PollVotesActionSheet, 'default', ({ props, result: rendered }) => {
		const result: Rendered = rendered;
		const guildId = guildIdOf((props as { channelId?: string } | undefined)?.channelId);
		const sheet = result?.props?.children;
		const children = sheet?.props?.children;

		if (!guildId || !Array.isArray(children)) return;

		const voters = children.find(
			(child: Rendered) =>
				typeof child?.type === 'function' && child.type.name === 'VotersList',
		);

		if (!voters) return;

		const colored = (
			<RoleColoredVotersList render={voters.type} props={voters.props} guildId={guildId} />
		);

		return cloneElement(result, {
			children: cloneElement(sheet, {
				children: children.map((child) => (child === voters ? colored : child)),
			}),
		});
	});
}

/**
 * @description Paints voters' names in poll result details with their role colors while `pollResults` is on.
 * Patches the render of `PollVotesActionSheet` (`modules/polls/native/PollVotesActionSheet.tsx`) and reads
 * `GuildMemberStore` and `ChannelStore`. The Addon scope removes the patch when the plugin stops.
 */
export function startPolls(): void {
	if (!ensureModules(`${PLUGIN_NAME}: poll results`, { GuildMemberStore, ChannelStore })) return;

	whileEnabled(settings, 'pollResults', true, patchPollVotesActionSheet);
	recordApplied(1);
}
