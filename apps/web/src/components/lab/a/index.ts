import type { LabVariant } from '~/components/lab/lab-variant';

import AddonsPage from './addons-page';
import ReviewPage from './review-page';
import AddonPage from './addon-page';
import UsersPage from './users-page';
import UserPage from './user-page';
import Layout from './layout';

const variant: LabVariant = {
	label: 'Workbench',
	pitch: 'Master-detail: a two-pane review inbox, compact lists with one actions menu per row, and tabbed detail pages whose edit form saves from one floating bar.',
	Layout,
	ReviewPage,
	AddonsPage,
	AddonPage,
	UsersPage,
	UserPage,
};

export default variant;
