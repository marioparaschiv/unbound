import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import { metro, patcher } from '@unbound-app/api';
import { cloneElement } from 'react';

import RoleColoredVotersList from '~/components/voters-list';
import { guildIdOf } from '~/lib/channel-guild';
import type { Rendered } from '~/lib/types';

// A sheet rendered while patched keeps calling the voters list's `renderItem` after the patch is removed.
let active = false;

function colorVoters(): () => void {
	const PollVotesActionSheet = metro.findByFilePath(
		'modules/polls/native/PollVotesActionSheet.tsx',
	);

	if (!PollVotesActionSheet) {
		logger.warn('Poll results skipped: Discord moved PollVotesActionSheet.');

		return () => {};
	}

	active = true;

	const unpatch = patcher.react.after(
		PollVotesActionSheet,
		'default',
		({ props, result: rendered }) => {
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
				<RoleColoredVotersList
					render={voters.type}
					props={voters.props}
					guildId={guildId}
					isActive={() => active}
				/>
			);

			return cloneElement(result, {
				children: cloneElement(sheet, {
					children: children.map((child) => (child === voters ? colored : child)),
				}),
			});
		},
	);

	return () => {
		plainPollVotes();
		unpatch();
	};
}

/**
 * @description Paints voters' names in poll result details with their role colors while `pollResults` is on.
 * Patches the render of `PollVotesActionSheet` (`modules/polls/native/PollVotesActionSheet.tsx`) and reads
 * `GuildMemberStore` and `ChannelStore`.
 */
export function patchPollVotes(): void {
	whileEnabled('pollResults', colorVoters);
}

/**
 * @description Draws plain names in the poll voter sheets already on screen. Call it after `patcher.unpatchAll()`.
 */
export function plainPollVotes(): void {
	active = false;
}
