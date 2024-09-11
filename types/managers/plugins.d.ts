import type { Addon } from '@typings/managers';
import type { ReactNode } from 'react';

export type Plugin = Addon & {
	instance: PluginInstance | null;
};

export interface PluginInstance {
	start?(): void;
	stop?(): void;
	getSettingsPanel?(): ReactNode;
}