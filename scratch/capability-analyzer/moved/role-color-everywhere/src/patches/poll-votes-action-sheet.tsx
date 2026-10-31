import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { cloneElement } from 'react';

import RoleColoredVotersList from '~/components/role-colored-voters-list';
import { ChannelStore, Patcher, PollVotesActionSheet } from '~/modules';
import { guildIdOf } from '~/channel-guild';
import { PLUGIN_NAME } from '~/constants';
import type { Rendered } from '~/types';

/**
 * @description Paints voters' names in poll result details with their role colors.
 * @returns A function that removes the patch.
 */
export function patchPollVotesActionSheet(): () => void {
	const feature = `${PLUGIN_NAME}: poll results`;

	if (!ensureModules(feature, { PollVotesActionSheet, ChannelStore })) return () => {};

	if (typeof PollVotesActionSheet.default !== 'function') {
		console.error(`[${feature}] Skipped, PollVotesActionSheet is not a function.`);

		return () => {};
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

export default patchPollVotesActionSheet;
