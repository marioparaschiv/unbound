import { auditDispatcher } from '~/dispatchers/audit';
import type { Dispatcher } from '~/dispatchers/types';

// Each track adds one import and one entry here.
export const dispatchers: Dispatcher[] = [auditDispatcher];

export default { dispatchers };
