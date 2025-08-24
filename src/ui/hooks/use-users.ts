import { AsyncUsers } from '@api/metro/api';
import { Users } from '@api/metro/stores';
import { Flux } from '@api/metro/common';


function useUsers(userIds: string[]) {
	const authorUsers = Flux.useStateFromStoresArray([Users], () => {
		userIds.forEach((id) => {
			if (id) {
				AsyncUsers.getUser(id);
			}
		});

		return userIds.map(id => Users.getUser(id));
	});

	return authorUsers.filter(Boolean);
}

export default useUsers;