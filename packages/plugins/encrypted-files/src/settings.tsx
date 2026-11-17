import { useSetting } from '@unbound-app/settings';
import { Discord } from '@unbound-app/api/metro/components';
import { flux, metro, toasts, ui } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { contactIds, contactKey, forgetContact, ownKeys } from '~/lib/keys';
import { fingerprint, keyText } from '~/lib/key-text';

function userName(id: string): string {
	const user = flux.getStore('User').getUser(id);

	return user?.globalName || user?.username || id;
}

function SettingsPanel() {
	useSetting('contacts');

	const { publicKey } = ownKeys();
	const contacts = contactIds();

	return (
		<ui.Page>
			<ui.Section title={messages.YOUR_KEY} description={messages.YOUR_KEY_SUBTITLE}>
				<ui.Row label={fingerprint(publicKey)} />
				<ui.Row
					label={messages.SHARE_KEY}
					onPress={() => {
						metro.common.Clipboard.setString(keyText(publicKey));
						toasts.success('KEY_COPIED');
					}}
				/>
			</ui.Section>
			<ui.Section title={messages.CONTACTS}>
				{contacts.length ? (
					contacts.map((id) => (
						<ui.Row
							key={id}
							label={userName(id)}
							subLabel={fingerprint(contactKey(id)!)}
							trailing={
								<Discord.Button
									size='sm'
									variant='secondary'
									text={messages.FORGET}
									onPress={() => forgetContact(id)}
								/>
							}
						/>
					))
				) : (
					<ui.Row label={messages.CONTACTS_EMPTY} />
				)}
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
