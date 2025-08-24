import * as Managers from '@managers';
import { useEffect } from 'react';

import useForceUpdate from './use-force-update';


function useAddons(type: keyof typeof Managers, search: string = '') {
	const forceUpdate = useForceUpdate();

	const manager = Managers[type];

	useEffect(() => {
		if (!manager) return;

		manager.on('load', forceUpdate);
		manager.on('unload', forceUpdate);
		manager.on('enabled', forceUpdate);
		manager.on('disabled', forceUpdate);

		return () => {
			manager.off('load', forceUpdate);
			manager.off('unload', forceUpdate);
			manager.off('enabled', forceUpdate);
			manager.off('disabled', forceUpdate);
		};
	}, []);

	if (!manager) return [];

	const entities = manager.getEntities();

	if (search) {
		return entities.filter((entity) => entity.data.name.toLowerCase().includes(search.toLowerCase()));
	} else {
		return entities;
	}
}

export default useAddons;