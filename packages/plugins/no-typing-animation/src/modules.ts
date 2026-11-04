import createRunningFlag from '@unbound-plugins/shared/react/running-flag';
import { flux, metro } from '@unbound-app/api';

export const Theme = metro.findByProps('colors', 'internal', { lazy: true });

export const TypingStore = flux.getStore('Typing', { lazy: true });

export const StillDotsRunning = createRunningFlag(addon.id);
