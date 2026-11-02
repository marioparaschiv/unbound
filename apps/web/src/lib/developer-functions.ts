import { addonAuthorSchema } from '@unbound-app/contracts/manifest';
import { createServerFn } from '@tanstack/react-start';
import { Type } from '@unbound-app/contracts/schema';

import { getDeveloper, listDevelopers } from '~/lib/developers';
import { schemaValidator } from '~/lib/schema-validator';
import app from '~/lib/app';

/**
 * @description Loads one page of the Team page's people, filtered by a name search.
 * @returns The page and the cursor of the next one.
 */
export const fetchDevelopers = createServerFn({ method: 'GET' })
	.validator(
		schemaValidator(
			Type.Object({
				search: Type.String({ maxLength: 100 }),
				cursor: Type.Optional(Type.String({ maxLength: 512 })),
			}),
		),
	)
	.handler(({ data }) => listDevelopers(app, data));

/**
 * @description Loads one person's Team profile with the listed addons that credit them.
 * @returns The profile, or `null` when they are not on the team and no listed addon credits them.
 */
export const fetchDeveloper = createServerFn({ method: 'GET' })
	.validator(schemaValidator(addonAuthorSchema.properties.id))
	.handler(async ({ data }) => (await getDeveloper(app, data)) ?? null);

export default { fetchDevelopers, fetchDeveloper };
