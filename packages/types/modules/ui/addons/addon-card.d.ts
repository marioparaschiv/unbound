import type { ManagerKind } from '@constants';

import type { Addon } from '../../managers';


export interface AddonCardProps {
	addon: Addon;
	kind: ManagerKind;
}