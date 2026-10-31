#import <AuthenticationServices/AuthenticationServices.h>
#import <SafariServices/SafariServices.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#import "Unbound.h"

@interface RCTLinkingManager : NSObject

+ (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options;

@end

#ifdef __cplusplus
extern "C" {
#endif
void SetAlternateIconName(NSString *iconName, void (^completion)(NSError *error));
#ifdef __cplusplus
}
#endif
