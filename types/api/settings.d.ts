import type { ImageSourcePropType } from 'react-native';

export interface SectionType {
	label: string;
	entries: AnyProps<{
		title: string;
		id: string;
		icon?: ImageSourcePropType;
		keywords?: string[];
		screen: (...args) => JSX.Element;
		mappable?: boolean;
	}>[];
};