import { findByName, findByProps } from '@api/metro';

export const BackdropFilters = findByProps('BackgroundBlurFill', { lazy: true });
export const Design = findByProps('RowButton', 'dismissAlerts', 'ContextMenu');
export const Portal = findByProps('PortalHost', 'Portal', { lazy: true });
export const Media = findByProps('openMediaModal', { lazy: true });
export const HelpMessage = findByName('HelpMessage');
export const Forms = findByProps('FormSliderRow');