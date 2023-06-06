import { PanelsSettings as _PanelsSettings } from './panels';
import { TabsSettings as _TabsSettings } from './tabs';

const PanelsSettings = new _PanelsSettings();
const TabsSettings = new _TabsSettings();

export function apply() {
    PanelsSettings.apply?.();
    TabsSettings.apply?.();
}

export function remove() {
    PanelsSettings.remove?.();
    TabsSettings.remove?.();
}