import { addonAuthorSchema } from '@unbound-app/contracts/manifest';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { getDeveloper, listDevelopers } from '~/lib/developers';
import app from '~/lib/app';

/**
 * @description Loads one page of the Team page's people, filtered by a name search.
 * @returns The page and the cursor of the next one.
 */
export const fetchDevelopers = createServerFn({ method: 'GET' })
	.validator(z.object({ search: z.string().max(100), cursor: z.string().max(512).optional() }))
	.handler(({ data }) => listDevelopers(app, data));

/**
 * @description Loads one person's Team profile with the listed addons that credit them.
 * @returns The profile, or `null` when they are not on the team and no listed addon credits them.
 */
export const fetchDeveloper = createServerFn({ method: 'GET' })
	.validator(addonAuthorSchema.shape.id)
	.handler(async ({ data }) => (await getDeveloper(app, data)) ?? null);

export default { fetchDevelopers, fetchDeveloper };
