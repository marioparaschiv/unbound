#import "RecoveryQuickAction.h"
#import "Unbound.h"

static NSString *const kRecoveryShortcutType = @"app.unbound.recovery.toggle";

@interface RecoveryQuickAction ()
+ (NSArray<UIApplicationShortcutItem *> *)itemsWithRecoveryAction:
    (NSArray<UIApplicationShortcutItem *> *)items;
+ (BOOL)handleShortcutItem:(UIApplicationShortcutItem *)item;
@end

@implementation RecoveryQuickAction

+ (NSArray<UIApplicationShortcutItem *> *)itemsWithRecoveryAction:
    (NSArray<UIApplicationShortcutItem *> *)items
{
    BOOL enabled = [Utilities isRecoveryModeEnabled];
    NSString *title = enabled ? @"Disable Safe Mode" : @"Enable Safe Mode";
    UIApplicationShortcutIcon *icon = [UIApplicationShortcutIcon iconWithSystemImageName:@"shield"];
    UIApplicationShortcutItem *recovery =
        [[UIApplicationShortcutItem alloc] initWithType:kRecoveryShortcutType
                                        localizedTitle:title
                                     localizedSubtitle:nil
                                                  icon:icon
                                              userInfo:nil];
    NSMutableArray<UIApplicationShortcutItem *> *updated =
        [NSMutableArray arrayWithObject:recovery];

    for (UIApplicationShortcutItem *item in items)
    {
        if (![item.type isEqualToString:kRecoveryShortcutType])
        {
            [updated addObject:item];
        }
    }

    return updated;
}

+ (BOOL)handleShortcutItem:(UIApplicationShortcutItem *)item
{
    if (![item.type isEqualToString:kRecoveryShortcutType])
    {
        return NO;
    }

    BOOL enabled = [RecoveryQuickAction toggleSafeMode];
    [Logger info:LOG_CATEGORY_DEFAULT
          format:@"Home Screen action %@ Safe Mode.", enabled ? @"enabled" : @"disabled"];
    return YES;
}

+ (BOOL)toggleSafeMode
{
    BOOL enabled = ![Utilities isRecoveryModeEnabled];
    [Settings set:@"unbound" key:@"recovery" value:@(enabled)];
    [Settings save];
    [RecoveryQuickAction refresh];
    return enabled;
}

+ (void)refresh
{
    UIApplication *application = [UIApplication sharedApplication];
    application.shortcutItems = application.shortcutItems ?: @[];
}

@end

%hook UIApplication

- (void)setShortcutItems:(NSArray<UIApplicationShortcutItem *> *)shortcutItems
{
    %orig([RecoveryQuickAction itemsWithRecoveryAction:shortcutItems]);
}

%end

%hook AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    [RecoveryQuickAction refresh];
    return %orig;
}

%end

%hook SceneDelegate

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
                 options:(UISceneConnectionOptions *)options
{
    [RecoveryQuickAction handleShortcutItem:options.shortcutItem];
    %orig;
}

- (void)windowScene:(UIWindowScene *)windowScene
    performActionForShortcutItem:(UIApplicationShortcutItem *)shortcutItem
              completionHandler:(void (^)(BOOL succeeded))completionHandler
{
    if ([RecoveryQuickAction handleShortcutItem:shortcutItem])
    {
        if (completionHandler)
        {
            completionHandler(YES);
        }
        [Utilities reloadApp];
        return;
    }

    %orig;
}

- (void)sceneWillResignActive:(UIScene *)scene
{
    [RecoveryQuickAction refresh];
    %orig;
}

%end
