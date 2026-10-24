#import "Haptics.h"

static NSError *vphoneHapticsUnavailableError(void)
{
    return [NSError errorWithDomain:@"com.apple.CoreHaptics"
                                code:4099
                            userInfo:@{NSLocalizedDescriptionKey : @"Unavailable on vphone"}];
}

%group VPhoneHaptics

%hook CHHapticEngine
- (instancetype)initAndReturnError:(NSError **)error
{
    if (error)
        *error = vphoneHapticsUnavailableError();
    return nil;
}

- (instancetype)initWithAudioSession:(AVAudioSession *)audioSession error:(NSError **)error
{
    if (error)
        *error = vphoneHapticsUnavailableError();
    return nil;
}
%end

%hook UIFeedbackGenerator
- (void)prepare
{
}
%end

%hook UIImpactFeedbackGenerator
- (void)impactOccurred
{
}

- (void)impactOccurredWithIntensity:(CGFloat)intensity
{
}
%end

%hook UISelectionFeedbackGenerator
- (void)selectionChanged
{
}
%end

%hook UINotificationFeedbackGenerator
- (void)notificationOccurred:(UINotificationFeedbackType)notificationType
{
}
%end

%end

%ctor
{
    if ([Utilities isVPhone])
    {
        %init(VPhoneHaptics);
    }
}
