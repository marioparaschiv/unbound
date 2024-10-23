import type { Addon } from '@typings/managers';
import type { ManagerKind } from '@constants';

export interface AddonListProps {
	addons: Addon[];
	kind: ManagerKind;
}