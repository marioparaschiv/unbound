#import <Foundation/Foundation.h>
#import <functional>
#import <jsi/jsi.h>

@interface RCTInstance : NSObject

- (void)_loadJSBundle:(NSURL *)sourceURL;
- (void)_loadScriptFromSource:(id)source;

- (void)callFunctionOnBufferedRuntimeExecutor:
    (std::function<void(facebook::jsi::Runtime &)> &&)executor;

@end
