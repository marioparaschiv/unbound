#import "astral.h"

@interface HotReload : NSObject <NSURLSessionDataDelegate>

+ (void)observe;

+ (void)sync;

@end
