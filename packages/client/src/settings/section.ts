import type { ComponentType } from 'react';
import type enUS from '@i18n/en-US.json';

/** A Settings section a domain's built-in adds: one page on Discord's settings screen. */
export type SectionEntry = {
	key: string;
	/** The i18n message key of the page title, read on each render so it follows the locale. */
	title: keyof typeof enUS;
	/** Discord's navigator renders the page with its own route props, so any component fits. */
	component: ComponentType<never>;
	icon?: string;
	usePredicate?: () => boolean;
	hidden?: boolean;
};
