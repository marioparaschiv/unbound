import type { ReactNode } from 'react';

import type { Addon } from '.';


export type Plugin = Addon & {
	instance: PluginInstance | null;
};

export interface PluginInstance {
	start?(): void;
	stop?(): void;
	getSettingsPanel?(): ReactNode;
}