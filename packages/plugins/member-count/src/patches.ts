import { metro, patcher } from '@unbound-app/api';
import { createElement } from 'react';
import { View } from 'react-native';

import styles from '~/patches.style';

const CHANNEL_HEADER = 'modules/main_tabs_v2/native/channel/header/ChannelHeaderShared.tsx';

type CountArgs = [presence: number, members: number, separated: boolean, accessoryWidth: number];

/**
 * @description Shows how many members a channel has beside how many are online in its header, as Discord shows one or
 * the other. Patches `renderMemberCountText` to draw Discord's own total beside its online count.
 */
export function patchMemberCountText(): void {
	const Header = metro.findByFilePath(CHANNEL_HEADER);

	if (typeof Header?.renderMemberCountText !== 'function') {
		logger.warn('Member count skipped: Discord moved renderMemberCountText.');

		return;
	}

	patcher.after(Header, 'renderMemberCountText', ({ args, result, original, this: self }) => {
		const [presence, members, , accessoryWidth] = args as CountArgs;

		if (!(presence > 0 && members > 0)) return result;

		return createElement(
			View,
			{ style: styles.counts },
			result,
			original.call(self, 0, members, false, accessoryWidth),
		);
	});
}
