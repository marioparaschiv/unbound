import type { FluxUser } from '@unbound-app/api/flux';
import { useEffect, useState } from 'react';
import { metro } from '@unbound-app/api';

import type { Entity, EntityKind } from './entity';

import { describeEntity } from './describe';

type UserActions = { getUser(id: string): Promise<FluxUser | undefined> };

const Actions = metro.findByProps('fetchProfile', 'getUser') as UserActions | undefined;

/**
 * @description Asks Discord for a user it has not loaded, such as one whose id was pasted.
 * @param id The user's id.
 * @returns A promise that settles once Discord answered, whether or not the user exists.
 */
export async function fetchUser(id: string): Promise<void> {
	try {
		await Actions?.getUser(id);
	} catch {
		// An unknown id or a network error leaves the user unresolved; the row shows the bare id.
	}
}

/**
 * @description Reads a user, channel or server by id, fetching a user Discord has not loaded yet.
 * @param kind What the id names.
 * @param id The id.
 * @returns The entity, or `undefined` while a user loads or when nothing has the id.
 */
function useEntity(kind: EntityKind, id: string): Entity | undefined {
	const [, setFetched] = useState(false);
	const entity = describeEntity(kind, id);

	useEffect(() => {
		if (kind !== 'user' || entity) return;

		let live = true;

		void fetchUser(id).then(() => live && setFetched(true));

		return () => {
			live = false;
		};
	}, [kind, id]);

	return entity;
}

export default useEntity;
