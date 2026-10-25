import { sharedStagedStickers } from '@unbound-plugins/shared/stickers/staged-stickers';
import { Animated, Pressable, type PressableStateCallbackType } from 'react-native';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Portal } from '@unbound-app/api/metro/components';

import { DraftStore, FluxHooks, Haptics, PreviewRunning, type Sticker } from '~/modules';
import { Button, CHANNEL_MESSAGE_DRAFT_TYPE, Timing } from '~/constants';
import PreviewOverlay from '~/components/preview-overlay';
import { dismissKeyboard } from '~/keyboard';

type PreviewButtonProps = {
	channelId: string;
	icon: number;
};

function useDraft(channelId: string): string {
	return FluxHooks.useStateFromStores(
		[DraftStore],
		() => DraftStore.getDraft(channelId, CHANNEL_MESSAGE_DRAFT_TYPE) ?? '',
	);
}

function useStickers(channelId: string): Sticker[] {
	return useSyncExternalStore(
		(onChange) => sharedStagedStickers().subscribe(channelId, onChange),
		() => sharedStagedStickers().get(channelId),
	);
}

// Collapses the button's slot while the draft is empty, and fades and scales it in once there is something to preview.
function useSlotAnimation(visible: boolean) {
	const [slotVisible, setSlotVisible] = useState(false);
	const slotVisibleRef = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

	function updateSlot(next: boolean) {
		timer.current = undefined;
		slotVisibleRef.current = next;
		setSlotVisible(next);
	}

	useEffect(() => {
		clearTimeout(timer.current);
		progress.stopAnimation();
		progress.setValue(0);

		function show() {
			updateSlot(true);
			Animated.timing(progress, {
				toValue: 1,
				duration: Timing.show,
				useNativeDriver: false,
			}).start();
		}

		if (visible) {
			if (slotVisibleRef.current) {
				show();
			} else {
				timer.current = setTimeout(show, Timing.showDelay);
			}

			return;
		}

		if (!slotVisibleRef.current) return;

		timer.current = setTimeout(() => updateSlot(false), Timing.hide);
	}, [visible, progress]);

	useEffect(() => () => clearTimeout(timer.current), []);

	return { slotVisible, progress };
}

function PreviewButton({ channelId, icon }: PreviewButtonProps) {
	const running = PreviewRunning.useRunning();
	const [open, setOpen] = useState(false);
	const cancelOpen = useRef<() => void>(undefined);
	const draft = useDraft(channelId);
	const stickers = useStickers(channelId);
	const visible = Boolean(draft.trim() || stickers.length);
	const { slotVisible, progress } = useSlotAnimation(visible);

	useEffect(() => () => cancelOpen.current?.(), []);

	function openPreview() {
		cancelOpen.current = dismissKeyboard(channelId, () => setOpen(true));
	}

	// The patch is gone once the plugin stops, but the chat input keeps this element until it re-renders.
	if (!running) return null;

	return (
		<>
			<Animated.View
				style={{
					width: slotVisible ? Button.size : 0,
					marginRight: slotVisible ? 0 : -Button.gap,
					height: Button.size,
					opacity: visible ? progress : 0,
					overflow: 'hidden',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<Pressable
					accessibilityRole='button'
					accessibilityLabel='Preview message'
					onPress={openPreview}
					onPressIn={() =>
						Haptics.triggerHapticFeedback?.(Haptics.HapticFeedbackTypes?.IMPACT_LIGHT)
					}
					hitSlop={8}
					style={({ pressed }: PressableStateCallbackType) => ({
						width: Button.size,
						height: Button.size,
						alignItems: 'center',
						justifyContent: 'center',
						opacity: pressed ? 0.5 : 1,
						transform: [{ scale: pressed ? 0.86 : 1 }],
					})}
				>
					<Animated.Image
						source={icon}
						style={{
							width: Button.iconSize,
							height: Button.iconSize,
							tintColor: '#b5bac1',
							transform: [
								{
									scale: progress.interpolate({
										inputRange: [0, 1],
										outputRange: [0.6, 1],
									}),
								},
							],
						}}
					/>
				</Pressable>
			</Animated.View>
			{open ? (
				<Portal.Portal>
					<PreviewOverlay
						channelId={channelId}
						content={draft}
						stickers={stickers}
						onClose={() => setOpen(false)}
					/>
				</Portal.Portal>
			) : null}
		</>
	);
}

export default PreviewButton;
