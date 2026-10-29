import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { DiscordFunction } from '@unbound-app/api/metro';
import { cloneElement } from 'react';

import { ChannelStore, Patcher, POLL_VOTES_ACTION_SHEET_PATH } from '~/modules';
import RoleColoredVotersList from '~/components/role-colored-voters-list';
import { guildIdOf } from '~/channel-guild';
import { PLUGIN_NAME } from '~/constants';
import type { Rendered } from '~/types';

type PollVotesActionSheetModule = {
	default: DiscordFunction;
};

function patchLoadedPollVotesActionSheet(PollVotesActionSheet: PollVotesActionSheetModule) {
	const feature = `${PLUGIN_NAME}: poll results`;

	if (!ensureModules(feature, { ChannelStore })) return;

	if (typeof PollVotesActionSheet.default !== 'function') {
		console.error(`[${feature}] Skipped, PollVotesActionSheet is not a function.`);

		return;
	}

	return Patcher.after(PollVotesActionSheet, 'default', ({ args: [props], result }) => {
		const guildId = guildIdOf(props?.channelId);
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
 * @description Paints voters' names in poll result details with their role colors, once the sheet's module loads.
 * @returns A function that stops waiting or removes the patch.
 */
export function patchPollVotesActionSheet(): () => void {
	return whenLoaded(POLL_VOTES_ACTION_SHEET_PATH, patchLoadedPollVotesActionSheet);
}

export default patchPollVotesActionSheet;
