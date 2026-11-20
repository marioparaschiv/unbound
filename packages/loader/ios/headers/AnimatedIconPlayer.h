#import <UIKit/UIKit.h>

#import "AnimatedIcon.h"

#ifdef __cplusplus
extern "C" {
#endif
BOOL UBAnimatedIconEnabled(void);
void UBSetAnimatedIconEnabled(BOOL enabled);
BOOL UBIconChangeIsBusy(NSError *error);
void UBShowAnimatedIconRest(void (^done)(NSError *error));
void UBStopAnimatedIcon(void);
#ifdef __cplusplus
}
#endif
