import type { ImageSourcePropType } from 'react-native';
import type { ComponentType } from 'react';


export interface SettingsEntry {
	type?: string;
	title: string;
	key: string;
	parent?: string;
	section?: string;
	excludeFromDisplay?: boolean;
	icon?: ImageSourcePropType;
	IconComponent?: ComponentType;
	screen: {
		route: string,
		getComponent: () => ComponentType;
	};
}

export interface RegisterSettingsEntriesPayload {
	type: string;
	entries: SettingsEntry[];
}