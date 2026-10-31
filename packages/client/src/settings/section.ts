import type { ComponentType } from 'react';
import type enUS from '@i18n/en-US.json';

export type SectionEntry = {
	key: string;
	titleKey: keyof typeof enUS;
	/** Discord's navigator renders the page with its own route props, so any component fits. */
	component: ComponentType<never>;
	icon?: string;
	usePredicate?: () => boolean;
	hidden?: boolean;
};
