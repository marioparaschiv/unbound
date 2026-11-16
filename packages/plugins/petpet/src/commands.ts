import type { NativeBridge } from '@unbound-app/api/native';
import { commands, flux } from '@unbound-app/api';

import { avatarUrl, type AvatarUser } from '~/lib/sources';
import { makePetPet } from '~/lib/make-petpet';

type UserStore = { getUser(id: string): AvatarUser | undefined };

/**
 * @description Adds `/petpet`, which turns a user's avatar into a head-patting GIF in the chat input.
 * @param native The plugin's native bridge.
 * @param folder The plugin's temporary folder.
 */
export function registerPetPet(native: NativeBridge, folder: string): void {
	commands.register({
		petpet: {
			description: 'PETPET_DESC',
			options: { user: commands.option.user({ description: 'PETPET_USER', required: true }) },
			async execute({ user }, { channel }) {
				const Users = flux.getStore('User') as unknown as UserStore;

				await makePetPet(
					native,
					folder,
					channel.id,
					avatarUrl(Users.getUser(user.id) ?? user),
				);
			},
		},
	});
}

export default { registerPetPet };
