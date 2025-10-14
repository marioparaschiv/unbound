import type { ManagerKind } from '@constants';

import type { Addon } from '../../managers';


export interface AddonListProps {
	addons: Addon[];
	kind: ManagerKind;
}