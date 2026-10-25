#import "Unbound.h"

@interface HotReload : NSObject <NSURLSessionDataDelegate>

+ (void)observe;

+ (void)sync;

@end
