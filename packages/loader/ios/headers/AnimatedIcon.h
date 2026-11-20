#import <UIKit/UIKit.h>

#import "Logger.h"
#import "Sideloading.h"

#ifdef __cplusplus
extern "C" {
#endif
extern NSString *const UBAnimatedIconId;
NSDictionary *UBAnimatedIconInfo(void);
BOOL UBAnimatedIconAvailable(void);
typedef void (^UBIconCompletion)(NSError *error);
typedef void (^UBIconSetter)(NSString *iconName, UBIconCompletion completion);
void UBSetAppIcon(NSString *iconName, UBIconCompletion completion, UBIconSetter setIcon);
#ifdef __cplusplus
}
#endif
