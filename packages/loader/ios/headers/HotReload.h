#import "Unbound.h"

@interface HotReload : NSObject <NSURLSessionDataDelegate>

+ (void)observe;

+ (void)sync;

@end

#ifdef __cplusplus
#include <memory>

#include "LoaderHotReload.h"

// The stream connection `loader::Loader` runs hot reload over, through the shared HotReload.
std::shared_ptr<loader::HotReloadTransport> UnboundHotReloadTransport();
#endif
