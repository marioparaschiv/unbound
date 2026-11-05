import { flux, metro } from '@unbound-app/api';

import { ELLIPSIS_PATH } from '~/constants';

export const Ellipsis = metro.findByFilePath(ELLIPSIS_PATH);

export const TypingStore = flux.getStore('Typing');
