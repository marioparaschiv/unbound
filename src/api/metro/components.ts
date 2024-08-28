import { find, findByName, findByProps } from '@api/metro';

export const Design = findByProps('RowButton', 'dismissAlerts', 'ContextMenu');
export const Slider = find(m => m.render?.name === 'SliderComponent');
export const Media = findByProps('openMediaModal', { lazy: true });
export const HelpMessage = findByName('HelpMessage');