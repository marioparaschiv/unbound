import { extendTailwindMerge } from 'tailwind-merge';
import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';

// The radius tokens in styles.css; without them `rounded-menu` would not replace a primitive's `rounded-surface`.
const twMerge = extendTailwindMerge({
	extend: { theme: { radius: ['item', 'control', 'inner', 'surface', 'menu', 'menu-item'] } },
});

/**
 * @description Joins class names and lets later Tailwind utilities override conflicting earlier ones.
 * @param inputs Class names, arrays and conditional class maps.
 * @returns The merged class string.
 */
function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

export default cn;
