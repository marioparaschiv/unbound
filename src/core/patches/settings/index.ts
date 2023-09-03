import { PanelsSettings } from './panels';
import { TabsSettings } from './tabs';

const Panels = new PanelsSettings();
const Tabs = new TabsSettings();

export function apply() {
	Panels.apply?.();
	Tabs.apply?.();
}

export function remove() {
	Panels.remove?.();
	Tabs.remove?.();
}