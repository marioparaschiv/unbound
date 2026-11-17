import { Image, Pressable, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { shuffledAnswers, type Answer } from '~/core/support-gate';
import { format, messages } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

import useStyles from './support-gate.style';

const READING_SECONDS = 10;

const ANSWER_LABELS: Record<Answer, () => string> = {
	chat: () => messages.UNBOUND_SUPPORT_GATE_ANSWER_CHAT,
	forum: () => messages.UNBOUND_SUPPORT_GATE_ANSWER_FORUM,
	dm: () => messages.UNBOUND_SUPPORT_GATE_ANSWER_DM,
};

function buttonLabel(secondsLeft: number, answered: boolean): string {
	if (secondsLeft > 0) {
		return format('UNBOUND_SUPPORT_GATE_WAIT', { seconds: secondsLeft });
	}

	return answered
		? messages.UNBOUND_SUPPORT_GATE_ACCEPT
		: messages.UNBOUND_SUPPORT_GATE_ANSWER_FIRST;
}

type SupportGateContentProps = {
	dismiss: () => void;
	onAccept: () => void;
	onOpenForum: () => void;
};

function useCountdown(seconds: number, restart: number): number {
	const [left, setLeft] = useState(seconds);

	useEffect(() => {
		setLeft(seconds);

		const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);

		return () => clearInterval(timer);
	}, [seconds, restart]);

	return left;
}

/**
 * @description The support gate's body: the red notice, a question that only a reader can answer, and the accept
 * button, which unlocks once the reading time has passed and the right answer is picked.
 * @param props `dismiss` closes the dialog; `onAccept` records the acceptance; `onOpenForum` goes to the forum.
 * @returns The gate's content.
 */
export default function SupportGateContent({
	dismiss,
	onAccept,
	onOpenForum,
}: SupportGateContentProps) {
	const styles = useStyles();
	const answers = useMemo(() => shuffledAnswers(), []);
	const [picked, setPicked] = useState<Answer>();
	const [mistakes, setMistakes] = useState(0);
	const left = useCountdown(READING_SECONDS, mistakes);
	const wrong = picked !== undefined && picked !== 'forum';
	const ready = picked === 'forum' && left === 0;

	function pick(answer: Answer) {
		setPicked(answer);

		if (answer !== 'forum') {
			setMistakes((count) => count + 1);
		}
	}

	return (
		<View style={styles.gate}>
			<View style={styles.notice}>
				<View style={styles.heading}>
					<Image source={icons.WarningIcon} style={styles.icon} />
					<Discord.Text variant='heading-md/extrabold' color='text-feedback-critical'>
						{messages.UNBOUND_SUPPORT_GATE_HEADING}
					</Discord.Text>
				</View>
				<Discord.Text variant='text-md/medium'>
					{messages.UNBOUND_SUPPORT_GATE_BODY}
				</Discord.Text>
				<Discord.Button
					text={messages.UNBOUND_SUPPORT_GATE_OPEN_FORUM}
					variant='destructive'
					onPress={() => {
						dismiss();
						onOpenForum();
					}}
				/>
			</View>
			<Discord.Text variant='text-md/semibold'>
				{messages.UNBOUND_SUPPORT_GATE_QUESTION}
			</Discord.Text>
			{answers.map((answer) => (
				<Pressable
					key={answer}
					accessibilityRole='radio'
					accessibilityState={{ checked: picked === answer }}
					onPress={() => pick(answer)}
					style={[styles.answer, picked === answer && wrong ? styles.answerWrong : null]}
				>
					<Discord.Text variant='text-md/medium'>
						{picked === answer ? '● ' : '○ '}
						{ANSWER_LABELS[answer]()}
					</Discord.Text>
				</Pressable>
			))}
			{wrong ? (
				<Discord.Text variant='text-sm/medium' color='text-feedback-critical'>
					{messages.UNBOUND_SUPPORT_GATE_WRONG}
				</Discord.Text>
			) : null}
			<Discord.Button
				text={buttonLabel(left, picked === 'forum')}
				disabled={!ready}
				onPress={() => {
					dismiss();
					onAccept();
				}}
			/>
		</View>
	);
}
