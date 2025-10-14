import { findByName, findByProps } from '~/api/metro';

import type { ComponentsModule, FlashListModule } from '../@unbound-app/types/api/metro/components';


export const Discord = findByProps('createStyles', 'dismissAlerts', 'ContextMenu', { lazy: true }) as ComponentsModule;
export const BackdropFilters = findByProps('BackgroundBlurFill', { lazy: true });
export const Portal = findByProps('PortalHost', 'Portal', { lazy: true });
export const Media = findByProps('openMediaModal', { lazy: true });
export const FlashList = findByProps('FlashList', { lazy: true }) as FlashListModule;
export const HelpMessage = findByName('HelpMessage');
export const Forms = findByProps('FormSliderRow');