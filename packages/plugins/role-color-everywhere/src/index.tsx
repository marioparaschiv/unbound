import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startMemberList } from '~/member-list';
import { startReactions } from '~/reactions';
import { startTyping } from '~/typing';
import { startChat } from '~/chat';
import { startVoice } from '~/voice';
import { startPolls } from '~/polls';

export const { start, stop, selfTest } = runFeatures([
	startChat,
	startTyping,
	startMemberList,
	startReactions,
	startPolls,
	startVoice,
]);
