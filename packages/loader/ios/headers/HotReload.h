#import "Unbound.h"

@interface HotReload : NSObject <NSURLSessionDataDelegate>

+ (instancetype)shared;

+ (void)observe;

+ (void)sync;

- (void)start;
- (void)stop;
- (void)sync;
- (void)connect;
- (void)scheduleReconnect;
- (NSURL *)resolveHotURL;
- (void)drainBuffer;
- (void)handleEvent:(NSString *)event;
- (void)handleReloadEtag:(NSString *)incoming;

@end
