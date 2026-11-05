import { flux, metro } from '@unbound-app/api';

import type { MemberStore } from '~/types';

export const GuildMemberStore: MemberStore = flux.getStore('GuildMember');
export const GuildRoleStore = flux.getStore('GuildRole');

export const UsersFastList = metro.findByFilePath(
	'modules/main_tabs_v2/native/shared_components/user_list/UsersFastList.tsx',
);
