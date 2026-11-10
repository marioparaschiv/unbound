import { getRequestHeaders } from '@tanstack/react-start/server';
import type { Caller } from '@unbound-app/contracts/account';
import { createServerFn } from '@tanstack/react-start';

import { toCallerProfile } from '~/lib/api/caller';
import { getApp } from '~/lib/app';

/** The signed-in user as pages see them: the API's caller shape. */
export type SessionUser = Caller;

export type PageSession = {
	user: SessionUser;
};

/**
 * @description Resolves the browser session from the request cookies, on the server, for route
 * `beforeLoad`s. Client navigations call it as a server function.
 * @returns The signed-in user, or null.
 */
export const getSession = createServerFn({ method: 'GET' }).handler(
	async (): Promise<PageSession | null> => {
		const session = await getApp().auth.api.getSession({ headers: getRequestHeaders() });

		if (!session) return null;

		return { user: toCallerProfile(session.user) };
	},
);

export default { getSession };
