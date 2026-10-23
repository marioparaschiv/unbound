import { addonRelations } from '~/db/schema/addons';
import { adminRelations } from '~/db/schema/admin';
import { authRelations } from '~/db/schema/auth';

const relations = { ...authRelations, ...addonRelations, ...adminRelations };

export default relations;
