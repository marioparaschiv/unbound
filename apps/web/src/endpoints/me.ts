import { meResponseSchema } from '@unbound-app/contracts/account';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint } from '~/lib/api/endpoint';
import { toCallerProfile } from '~/lib/api/caller';

const me = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: meResponseSchema },
	async ({ caller: { user } }) => ({ user: toCallerProfile(user) }),
);

export default me;
