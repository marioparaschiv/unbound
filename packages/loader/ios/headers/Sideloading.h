#import "Unbound.h"
#import <AuthenticationServices/AuthenticationServices.h>
#import <SafariServices/SafariServices.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@interface RCTLinkingManager : NSObject

+ (BOOL)application:(UIApplication *)application
             openURL:(NSURL *)url
             options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options;

@end

void SetAlternateIconName(NSString *iconName, void (^completion)(NSError *error));
