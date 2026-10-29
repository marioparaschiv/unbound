import type { LabVariant } from '~/components/lab/lab-variant';

import AddonsPage from './addons-page';
import ReviewPage from './review-page';
import AddonPage from './addon-page';
import UsersPage from './users-page';
import UserPage from './user-page';
import Layout from './layout';

const variant: LabVariant = {
	label: 'Settings page',
	pitch: 'One calm scrolling document per page: a section nav on the left, plain fields that override the manifest as you type, and a save bar that says what changed.',
	Layout,
	ReviewPage,
	AddonsPage,
	AddonPage,
	UsersPage,
	UserPage,
};

export default variant;
