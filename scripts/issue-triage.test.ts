import { describe, expect, test } from 'bun:test';

import { parseFormAnswers, triageIssue } from './issue-triage';

const bugReport = [
	'### Platform',
	'',
	'Android',
	'',
	'### Where is the problem?',
	'',
	'A first-party plugin',
	'',
	'### Plugin',
	'',
	'Chat Bubbles',
	'',
	'### Environment',
	'',
	'- **Unbound:** v0.11.0',
	'- **Discord:** 352.14',
	'',
	'### Logs',
	'',
	'_No response_',
].join('\n');

describe('issue triage', () => {
	test('reads each form section and treats a blank answer as empty', () => {
		const answers = parseFormAnswers(bugReport);

		expect(answers.Platform).toBe('Android');
		expect(answers.Plugin).toBe('Chat Bubbles');
		expect(answers.Logs).toBe('');
	});

	test('labels the platform and a plugin, skipping labels the issue already has', () => {
		expect(triageIssue(bugReport, ['Bug', 'Android'])).toEqual({
			labels: ['Plugin'],
			needsDetails: false,
		});
	});

	test('labels both platforms a plugin idea targets', () => {
		const idea = '### Plugin\n\nNew plugin\n\n### Platforms\n\niOS, Android';

		expect(triageIssue(idea, ['Feature']).labels).toEqual(['iOS', 'Android', 'Plugin']);
	});

	test('asks for details when a bug report has no versions', () => {
		const vague = bugReport.replace(
			/### Environment\n\n[\s\S]*?\n\n###/,
			'### Environment\n\nmy phone\n\n###',
		);

		expect(triageIssue(vague, ['Bug']).needsDetails).toBe(true);
		expect(triageIssue('just broken', ['Bug']).needsDetails).toBe(true);
		expect(triageIssue('just an idea', ['Feature']).needsDetails).toBe(false);
	});

	test('labels the loader and the website from the area', () => {
		expect(
			triageIssue('### Area\n\nLoader (installing, updating, recovery menu)', []).labels,
		).toEqual(['Loader']);
		expect(triageIssue('### Area\n\nWebsite or marketplace', []).labels).toEqual(['Web']);
		expect(
			triageIssue(
				'### Where is the problem?\n\nLoader (installing, updating, recovery menu)',
				[],
			).labels,
		).toEqual(['Loader']);
	});
});
