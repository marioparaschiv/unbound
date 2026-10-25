import { releasesDispatcher } from '~/dispatchers/releases';
import { addonsDispatcher } from '~/dispatchers/addons';
import { auditDispatcher } from '~/dispatchers/audit';
import { rolesDispatcher } from '~/dispatchers/roles';
import type { Dispatcher } from '~/dispatchers/types';

// Each track adds one import and one entry here.
export const dispatchers: Dispatcher[] = [
	addonsDispatcher,
	releasesDispatcher,
	auditDispatcher,
	rolesDispatcher,
];

export default { dispatchers };
