import { meResponseSchema } from '@unbound-app/contracts/account';
import { z } from 'zod';

import { callerEndpoint } from '~/lib/api/endpoint';
import { toCallerProfile } from '~/lib/api/caller';

const me = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: meResponseSchema },
	async ({ caller: { user } }) => ({ user: toCallerProfile(user) }),
);

export default me;
