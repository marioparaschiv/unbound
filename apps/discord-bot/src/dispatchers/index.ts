import { rolesDispatcher } from '~/dispatchers/roles';
import type { Dispatcher } from '~/dispatchers/types';

// Each track adds one import and one entry here.
export const dispatchers: Dispatcher[] = [rolesDispatcher];

export default { dispatchers };
