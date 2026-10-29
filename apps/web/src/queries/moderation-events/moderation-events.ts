import { infiniteQueryOptions } from '@tanstack/react-query';
import type { Subject } from '@unbound-app/contracts/admin';

import { adminAddonQuery } from '~/queries/admin-addons/admin-addons';
import { adminUserQuery } from '~/queries/admin-users/admin-users';
import { fetchEvents } from '~/lib/admin-functions';

/**
 * @description The key of a subject's admin page, which prefixes its moderation log, so one invalidation refreshes both.
 * @param subject The addon or user.
 * @returns The subject's admin page query key.
 */
export function subjectKey(subject: Subject) {
	switch (subject.type) {
		case 'addon': {
			return adminAddonQuery(subject.id).queryKey;
		}

		case 'user': {
			return adminUserQuery(subject.id).queryKey;
		}
	}
}

/**
 * @description A subject's moderation log, newest first, one older page per "Load older events".
 * @param subject The addon or user.
 * @returns Options for `useInfiniteQuery`, paging by the timeline's `before`.
 */
export function moderationEventsQuery(subject: Subject) {
	return infiniteQueryOptions({
		queryKey: [...subjectKey(subject), 'events'],
		queryFn: ({ pageParam, signal }) =>
			fetchEvents({ data: { subject, before: pageParam }, signal }),
		initialPageParam: undefined as number | undefined,
		getNextPageParam: (page) => page.before ?? undefined,
	});
}

export default { subjectKey, moderationEventsQuery };
