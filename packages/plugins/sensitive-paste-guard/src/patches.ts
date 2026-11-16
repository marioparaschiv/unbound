import { guardSends, type SendArgs } from '@unbound-plugins/shared/composer/held-send';
import { messages } from '@unbound-app/i18n';
import { dialogs } from '@unbound-app/api';

import { findSecrets, redactSecrets, type SecretKind, type SecretMatch } from '~/lib/secrets';

type Choice = 'redact' | 'send' | 'edit';

const KIND_NAMES: Record<SecretKind, () => string> = {
	privateKey: () => messages.KIND_PRIVATE_KEY,
	discordToken: () => messages.KIND_DISCORD_TOKEN,
	githubToken: () => messages.KIND_GITHUB_TOKEN,
	awsKey: () => messages.KIND_AWS_KEY,
	slackToken: () => messages.KIND_SLACK_TOKEN,
	stripeKey: () => messages.KIND_STRIPE_KEY,
	googleKey: () => messages.KIND_GOOGLE_KEY,
	aiKey: () => messages.KIND_AI_KEY,
	jwt: () => messages.KIND_JWT,
	password: () => messages.KIND_PASSWORD,
};

function describeKinds(secrets: SecretMatch[]): string {
	const names = [...new Set(secrets.map((secret) => KIND_NAMES[secret.kind]()))];

	return typeof Intl.ListFormat === 'function'
		? new Intl.ListFormat(undefined, { type: 'conjunction' }).format(names)
		: names.join(', ');
}

function askAboutSecrets(secrets: SecretMatch[]): Promise<Choice> {
	return new Promise((resolve) => {
		dialogs.showDialog({
			title: messages.TITLE,
			body: messages.BODY.replace('{kinds}', describeKinds(secrets)),
			buttons: [
				{ label: messages.REDACT, onPress: () => resolve('redact') },
				{ label: messages.SEND, variant: 'destructive', onPress: () => resolve('send') },
			],
			cancel: messages.EDIT,
			onCancel: () => resolve('edit'),
			onDismiss: () => resolve('edit'),
		});
	});
}

async function guardSecrets([, message]: SendArgs): Promise<boolean> {
	const secrets = findSecrets(message.content);

	if (secrets.length === 0) return true;

	const choice = await askAboutSecrets(secrets);

	if (choice === 'redact')
		message.content = redactSecrets(message.content, secrets, messages.MARKER);

	return choice !== 'edit';
}

/**
 * @description Asks before sending a message that looks like it holds a secret: send it, send it with the secrets
 * redacted, or put it back in the chat input.
 */
export function patchSends(): void {
	guardSends('Sensitive Paste Guard', guardSecrets);
}

export default { patchSends };
