import { releasesDispatcher } from '~/dispatchers/releases';
import { addonsDispatcher } from '~/dispatchers/addons';
import { rolesDispatcher } from '~/dispatchers/roles';
import type { Dispatcher } from '~/dispatchers/types';

// Each track adds one import and one entry here.
export const dispatchers: Dispatcher[] = [addonsDispatcher, releasesDispatcher, rolesDispatcher];

export default { dispatchers };
