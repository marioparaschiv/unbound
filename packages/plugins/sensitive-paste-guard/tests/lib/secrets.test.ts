import { describe, expect, test } from 'bun:test';

import { findSecrets, redactSecrets } from '~/lib/secrets';

const discordToken = [
	'MTIzNDU2Nzg5MDEyMzQ1Njc4OQ',
	'GaBcDe',
	'abcdefghijklmnopqrstuvwxyz0123456789AB',
].join('.');
const githubToken = `ghp_${'a1B2'.repeat(9)}`;
const privateKey =
	'-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAA\n-----END OPENSSH PRIVATE KEY-----';

describe('findSecrets', () => {
	test('finds tokens, keys and private key blocks', () => {
		const kinds = findSecrets(`token ${discordToken} and ${githubToken}\n${privateKey}`).map(
			(secret) => secret.kind,
		);

		expect(kinds).toEqual(['discordToken', 'githubToken', 'privateKey']);
	});

	test('finds only the value after a password label', () => {
		const content = 'my password: hunter2hunter2 ok';
		const [secret] = findSecrets(content);

		expect(secret?.kind).toBe('password');
		expect(content.slice(secret!.start, secret!.end)).toBe('hunter2hunter2');
	});

	test('leaves ordinary messages alone', () => {
		expect(findSecrets('what is the password policy? it says secret = no')).toEqual([]);
		expect(findSecrets('see https://example.com/a.b.c and ask-me-later')).toEqual([]);
	});
});

describe('redactSecrets', () => {
	test('replaces every secret with the marker', () => {
		const content = `a ${githubToken} b password=supersecret1 c`;

		expect(redactSecrets(content, findSecrets(content), '[redacted]')).toBe(
			'a [redacted] b password=[redacted] c',
		);
	});
});
