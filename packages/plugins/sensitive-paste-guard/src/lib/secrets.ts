export type SecretKind =
	| 'privateKey'
	| 'discordToken'
	| 'githubToken'
	| 'awsKey'
	| 'slackToken'
	| 'stripeKey'
	| 'googleKey'
	| 'aiKey'
	| 'jwt'
	| 'password';

type SecretPattern = { kind: SecretKind; pattern: RegExp; keep?: number };

export type SecretMatch = { kind: SecretKind; start: number; end: number };

const PATTERNS: SecretPattern[] = [
	{
		kind: 'privateKey',
		pattern:
			/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )*PRIVATE KEY-----|$)/g,
	},
	{ kind: 'discordToken', pattern: /\b[MNO][\w-]{23,27}\.[\w-]{6}\.[\w-]{27,40}\b/g },
	{ kind: 'githubToken', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_\w{60,})\b/g },
	{ kind: 'awsKey', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
	{ kind: 'slackToken', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
	{ kind: 'stripeKey', pattern: /\b[rs]k_live_[A-Za-z0-9]{20,}\b/g },
	{ kind: 'googleKey', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
	{ kind: 'aiKey', pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}\b/g },
	{ kind: 'jwt', pattern: /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g },
	{
		kind: 'password',
		pattern:
			/\b(?:password|passwd|pwd|passphrase|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["']?([^\s"']{6,})/gi,
		keep: 1,
	},
];

function overlaps(match: SecretMatch, taken: SecretMatch[]): boolean {
	return taken.some((other) => match.start < other.end && other.start < match.end);
}

function matchesOf({ kind, pattern, keep }: SecretPattern, content: string): SecretMatch[] {
	return [...content.matchAll(pattern)].map((match) => {
		const value = keep === undefined ? match[0] : (match[keep] ?? match[0]);
		const start = (match.index ?? 0) + match[0].lastIndexOf(value);

		return { kind, start, end: start + value.length };
	});
}

/**
 * @description Finds what looks like a secret in a message: private keys, tokens and keys with a known shape, JWTs,
 * and values written after words such as `password:`.
 * @param content The message text.
 * @returns The secrets found, in text order, without overlaps.
 */
export function findSecrets(content: string): SecretMatch[] {
	const found: SecretMatch[] = [];

	for (const entry of PATTERNS) {
		for (const match of matchesOf(entry, content)) {
			if (!overlaps(match, found)) found.push(match);
		}
	}

	return found.sort((a, b) => a.start - b.start);
}

/**
 * @description Replaces each secret in a message with a marker.
 * @param content The message text.
 * @param secrets The secrets `findSecrets` found in it.
 * @param marker What replaces each secret.
 * @returns The message without the secrets.
 */
export function redactSecrets(content: string, secrets: SecretMatch[], marker: string): string {
	let redacted = content;

	for (const { start, end } of [...secrets].sort((a, b) => b.start - a.start)) {
		redacted = redacted.slice(0, start) + marker + redacted.slice(end);
	}

	return redacted;
}

export default { findSecrets, redactSecrets };
