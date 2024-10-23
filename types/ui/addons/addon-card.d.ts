import type { Addon } from '@typings/managers';
import type { ManagerKind } from '@constants';

export interface AddonCardProps {
	addon: Addon;
	kind: ManagerKind;
}