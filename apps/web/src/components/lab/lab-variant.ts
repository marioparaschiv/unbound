import type { ComponentType, ReactNode } from 'react';

export type LabVariantId = 'a' | 'b' | 'c';

export type LabLayoutProps = {
	children: ReactNode;
};

/** One staff-area redesign: the shell around its pages and one component per staff page. */
export type LabVariant = {
	label: string;
	/** One line naming the idea the variant tests. */
	pitch: string;
	Layout: ComponentType<LabLayoutProps>;
	ReviewPage: ComponentType;
	AddonsPage: ComponentType;
	AddonPage: ComponentType;
	UsersPage: ComponentType;
	UserPage: ComponentType;
};

export const LAB_VARIANT_IDS: LabVariantId[] = ['a', 'b', 'c'];

/**
 * @description Narrows a route param to a lab variant id.
 * @param value The `$variant` route param.
 * @returns Whether the param names a variant.
 */
export function isLabVariantId(value: string): value is LabVariantId {
	return LAB_VARIANT_IDS.some((id) => id === value);
}

export default { LAB_VARIANT_IDS, isLabVariantId };
