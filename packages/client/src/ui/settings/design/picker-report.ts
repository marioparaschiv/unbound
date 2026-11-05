import noop from '@unbound-app/utils/noop';
import { createContext } from 'react';

import type { HeaderOptions } from './navigation';

export type PickerKind = 'theme' | 'icon-pack';

/** Lets each picker hand its header to the page, which decides whose header the stack shows. */
export const ReportPicker = createContext<(kind: PickerKind, options: HeaderOptions) => void>(noop);
