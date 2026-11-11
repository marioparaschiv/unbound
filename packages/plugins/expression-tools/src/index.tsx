import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { expressionFeatures } from '~/expression-actions';

export const { start, stop, selfTest } = runFeatures(expressionFeatures);
