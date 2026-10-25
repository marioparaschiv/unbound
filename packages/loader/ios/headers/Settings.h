#import "Unbound.h"

#ifdef __cplusplus
extern "C" {
#endif
extern NSString *const SettingsDidChangeNotification;
#ifdef __cplusplus
}
#endif

@interface Settings : NSObject

+ (void)loadSettings;
+ (void)init;

@end
