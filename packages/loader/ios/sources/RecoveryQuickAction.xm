#import "RecoveryQuickAction.h"

#import "CoreBridge.h"
#import "CoreConversions.h"
#import "astral.h"

using astral::ios::toNSString;
using astral::ios::toStdString;

static NSString *recoveryShortcutType(void)
{
    static NSString       *type = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken,
                  ^{ type = [CoreBridge toolbox:@"recovery-shortcut-action" argument:@""]; });
    return type;
}

static NSString *const kDiscordShortcutItemsKey = @"AstralDiscordShortcutItems";

static NSDictionary *shortcutRecord(UIApplicationShortcutItem *item)
{
    NSMutableDictionary *record = [NSMutableDictionary dictionaryWithObject:item.type ?: @""
                                                                     forKey:@"type"];
    record[@"title"]            = item.localizedTitle ?: @"";
    record[@"subtitle"]         = item.localizedSubtitle;
    if (item.userInfo && [NSPropertyListSerialization propertyList:item.userInfo
                                                  isValidForFormat:NSPropertyListBinaryFormat_v1_0])
    {
        record[@"userInfo"] = item.userInfo;
    }
    if ([item.icon respondsToSelector:NSSelectorFromString(@"systemImageName")])
    {
        id iconName = [item.icon valueForKey:@"systemImageName"];
        if ([iconName isKindOfClass:[NSString class]])
        {
            record[@"systemImageName"] = iconName;
        }
    }
    return record;
}

static UIApplicationShortcutItem *shortcutFromRecord(NSDictionary *record)
{
    NSString *type  = record[@"type"];
    NSString *title = record[@"title"];
    if (![type isKindOfClass:[NSString class]] || ![title isKindOfClass:[NSString class]])
    {
        return nil;
    }
    NSString                  *subtitle = record[@"subtitle"];
    NSString                  *iconName = record[@"systemImageName"];
    NSDictionary              *userInfo = record[@"userInfo"];
    UIApplicationShortcutIcon *icon =
        [iconName isKindOfClass:[NSString class]]
            ? [UIApplicationShortcutIcon iconWithSystemImageName:iconName]
            : nil;
    return [[UIApplicationShortcutItem alloc]
             initWithType:type
           localizedTitle:title
        localizedSubtitle:[subtitle isKindOfClass:[NSString class]] ? subtitle : nil
                     icon:icon
                 userInfo:[userInfo isKindOfClass:[NSDictionary class]] ? userInfo : nil];
}

static NSArray<UIApplicationShortcutItem *> *savedDiscordShortcutItems(void)
{
    NSArray *records = [[NSUserDefaults standardUserDefaults] arrayForKey:kDiscordShortcutItemsKey];
    NSMutableArray<UIApplicationShortcutItem *> *items = [NSMutableArray array];
    for (NSDictionary *record in records)
    {
        UIApplicationShortcutItem *item =
            [record isKindOfClass:[NSDictionary class]] ? shortcutFromRecord(record) : nil;
        if (item)
        {
            [items addObject:item];
        }
    }
    return items;
}

static void saveDiscordShortcutItems(NSArray<UIApplicationShortcutItem *> *items)
{
    NSMutableArray *records = [NSMutableArray arrayWithCapacity:items.count];
    for (UIApplicationShortcutItem *item in items)
    {
        [records addObject:shortcutRecord(item)];
    }
    [[NSUserDefaults standardUserDefaults] setObject:records forKey:kDiscordShortcutItemsKey];
}

static NSArray<UIApplicationShortcutItem *> *currentDiscordShortcutItems = nil;

static NSArray<UIApplicationShortcutItem *> *discordShortcutItems(void)
{
    if (!currentDiscordShortcutItems)
    {
        currentDiscordShortcutItems = savedDiscordShortcutItems();
    }
    return currentDiscordShortcutItems;
}

static void showRecoveryStatus(NSString *status)
{
    UIAlertAction *okay = [UIAlertAction actionWithTitle:@"Okay"
                                                   style:UIAlertActionStyleDefault
                                                 handler:nil];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t) (1.0 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(),
                   ^{ [Utilities alert:nil title:status buttons:@[ okay ]]; });
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
    NSString                  *title = [CoreBridge preference:@"recovery-label" argument:@""];
    UIApplicationShortcutIcon *icon = [UIApplicationShortcutIcon iconWithSystemImageName:@"shield"];
    UIApplicationShortcutItem *recovery =
        [[UIApplicationShortcutItem alloc] initWithType:recoveryShortcutType()
                                         localizedTitle:title
                                      localizedSubtitle:nil
                                                   icon:icon
                                               userInfo:nil];
    NSMutableArray<UIApplicationShortcutItem *> *updated =
        [NSMutableArray arrayWithObject:recovery];

    nlohmann::json types = nlohmann::json::array();
    for (UIApplicationShortcutItem *item in items)
    {
        types.push_back(toStdString(item.type));
    }
    NSArray *kept = [CoreBridge toolboxArray:@"recovery-shortcut-order"
                                    argument:toNSString(types.dump())];
    for (NSNumber *index in kept)
    {
        if ([index isKindOfClass:[NSNumber class]] && index.unsignedIntegerValue < items.count)
        {
            [updated addObject:items[index.unsignedIntegerValue]];
        }
    }

    return updated;
}

+ (BOOL)handleShortcutItem:(UIApplicationShortcutItem *)item
{
    NSDictionary *toggle = [CoreBridge toolboxObject:@"recovery-shortcut-activate"
                                            argument:item.type ?: @""];
    if (![toggle[@"handled"] boolValue])
    {
        return NO;
    }

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
    [UIApplication sharedApplication].shortcutItems = discordShortcutItems();
}

@end

%hook UIApplication

- (void)setShortcutItems:(NSArray<UIApplicationShortcutItem *> *)shortcutItems
{
    NSArray<UIApplicationShortcutItem *> *items =
        [shortcutItems isKindOfClass:[NSArray class]] ? shortcutItems : @[];
    if (![items isEqualToArray:currentDiscordShortcutItems])
    {
        currentDiscordShortcutItems = [items copy];
        saveDiscordShortcutItems(currentDiscordShortcutItems);
    }
    %orig([RecoveryQuickAction itemsWithRecoveryAction:currentDiscordShortcutItems]);
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
