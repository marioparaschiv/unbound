import { flux, native } from '@unbound-app/api';

import type { SoundManager } from '~/moyai/sound';

export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const DCDSoundManager = native.getNativeModule<SoundManager>('DCDSoundManager');
