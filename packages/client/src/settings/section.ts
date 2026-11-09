import type { ComponentType, ReactNode } from 'react';
import type enUS from '@i18n/en-US.json';

export type SectionEntry = {
	key: string;
	titleKey: keyof typeof enUS;
	/**
	 * Loads the page when Discord's navigator first opens it, so startup never evaluates the page's modules. The
	 * navigator renders it with its own route props, so any component fits.
	 */
	getComponent: () => ComponentType<never>;
	/** An asset name drawn as Discord's row icon, or a component drawn as is. */
	icon?: string | ComponentType;
	usePredicate?: () => boolean;
	/** A hook returning what the overview row shows at its end, such as a count. */
	useTrailing?: () => ReactNode;
	hidden?: boolean;
};
