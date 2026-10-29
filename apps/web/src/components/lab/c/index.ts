import type { LabVariant } from '~/components/lab/lab-variant';

import AddonsPage from './addons-page';
import ReviewPage from './review-page';
import AddonPage from './addon-page';
import UsersPage from './users-page';
import UserPage from './user-page';
import Layout from './layout';

const variant: LabVariant = {
	label: 'Storefront',
	pitch: 'Staff see and edit the addon the way the store shows it: click a name or description to change it in place, with staff controls in one rail and a single activity timeline.',
	Layout,
	ReviewPage,
	AddonsPage,
	AddonPage,
	UsersPage,
	UserPage,
};

export default variant;
