#import <UIKit/UIKit.h>

static NSString *const kAstralPrefix = @"astral://";
// Discord registers this scheme on every install, and its router ignores the astral host.
static NSString *const kRelayPrefix = @"com.hammerandchisel.discord://astral/";

@interface ULSceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (strong, nonatomic) UIWindow *window;
@property (strong, nonatomic) NSURL    *pendingURL;
@end

static NSURL *relayURL(NSURL *url)
{
    NSString *string = url.absoluteString;
    if (string.length <= kAstralPrefix.length ||
        [string rangeOfString:kAstralPrefix options:NSCaseInsensitiveSearch | NSAnchoredSearch]
                .location == NSNotFound)
    {
        return nil;
    }
    return [NSURL URLWithString:[kRelayPrefix stringByAppendingString:[string substringFromIndex:kAstralPrefix.length]]];
}

static NSURL *firstRelayURL(NSSet<UIOpenURLContext *> *contexts)
{
    for (UIOpenURLContext *context in contexts)
    {
        NSURL *target = relayURL(context.URL);
        if (target)
        {
            return target;
        }
    }
    return nil;
}

@implementation ULSceneDelegate

// iOS asks the user before an app that is not yet active opens another app, so wait until active.
- (void)relay:(NSURL *)target scene:(UIScene *)scene
{
    if (!target)
    {
        return;
    }
    if (scene.activationState != UISceneActivationStateForegroundActive)
    {
        self.pendingURL = target;
        return;
    }
    self.pendingURL = nil;
    [UIApplication.sharedApplication openURL:target options:@{} completionHandler:nil];
}

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
                 options:(UISceneConnectionOptions *)connectionOptions
{
    if ([scene isKindOfClass:[UIWindowScene class]])
    {
        self.window                    = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
        self.window.rootViewController = [UIViewController new];
        [self.window makeKeyAndVisible];
    }
    [self relay:firstRelayURL(connectionOptions.URLContexts) scene:scene];
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
    [self relay:firstRelayURL(URLContexts) scene:scene];
}

- (void)sceneDidBecomeActive:(UIScene *)scene
{
    [self relay:self.pendingURL scene:scene];
}

@end
