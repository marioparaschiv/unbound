import type { ComponentType, ReactNode } from 'react';
import type enUS from '@i18n/en-US.json';

export type SectionEntry = {
	key: string;
	titleKey: keyof typeof enUS;
	/** Discord's navigator renders the page with its own route props, so any component fits. */
	component: ComponentType<never>;
	/** An asset name drawn as Discord's row icon, or a component drawn as is. */
	icon?: string | ComponentType;
	usePredicate?: () => boolean;
	/** A hook returning what the overview row shows at its end, such as a count. */
	useTrailing?: () => ReactNode;
	hidden?: boolean;
};
