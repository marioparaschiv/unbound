#import "CoreBridge.h"
#import "RecoveryQuickAction.h"
#import "Unbound.h"

static NSString *recoveryShortcutType(void)
{
    static NSString       *type = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{ type = [CoreBridge toolbox:@"recovery-shortcut-action" argument:@""]; });
    return type;
}

static void showRecoveryStatus(NSString *status)
{
    UIAlertAction *okay = [UIAlertAction actionWithTitle:@"Okay" style:UIAlertActionStyleDefault handler:nil];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t) (1.0 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{ [Utilities alert:nil title:status buttons:@[ okay ]]; });
}

@interface RecoveryQuickAction ()
+ (NSArray<UIApplicationShortcutItem *> *)itemsWithRecoveryAction:
    (NSArray<UIApplicationShortcutItem *> *)items;
+ (BOOL)handleShortcutItem:(UIApplicationShortcutItem *)item;
@end

@implementation RecoveryQuickAction

+ (NSArray<UIApplicationShortcutItem *> *)itemsWithRecoveryAction:
    (NSArray<UIApplicationShortcutItem *> *)items
{
    NSString *title = [CoreBridge preference:@"recovery-label" argument:@""];
    UIApplicationShortcutIcon *icon = [UIApplicationShortcutIcon iconWithSystemImageName:@"shield"];
    UIApplicationShortcutItem *recovery =
        [[UIApplicationShortcutItem alloc] initWithType:recoveryShortcutType()
                                        localizedTitle:title
                                     localizedSubtitle:nil
                                                  icon:icon
                                              userInfo:nil];
    NSMutableArray<UIApplicationShortcutItem *> *updated =
        [NSMutableArray arrayWithObject:recovery];

    for (UIApplicationShortcutItem *item in items)
    {
        if (![item.type isEqualToString:recoveryShortcutType()])
        {
            [updated addObject:item];
        }
    }

    return updated;
}

+ (BOOL)handleShortcutItem:(UIApplicationShortcutItem *)item
{
    if (![item.type isEqualToString:recoveryShortcutType()])
    {
        return NO;
    }

    NSDictionary *toggle = [CoreBridge toolboxObject:@"recovery-shortcut" argument:@""];
    [RecoveryQuickAction refresh];
    showRecoveryStatus(toggle[@"status"]);
    if ([toggle[@"restartRequired"] boolValue])
    {
        [Utilities reloadApp];
    }
    return YES;
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
