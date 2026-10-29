import type { LabVariant, LabVariantId } from '~/components/lab/lab-variant';
import variantA from '~/components/lab/a';
import variantB from '~/components/lab/b';
import variantC from '~/components/lab/c';

/** Every staff-area redesign in the lab, by its route param. */
export const LAB_VARIANTS: Record<LabVariantId, LabVariant> = {
	a: variantA,
	b: variantB,
	c: variantC,
};

export default LAB_VARIANTS;
