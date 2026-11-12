#import "Toolbox.h"

#import "CoreBridge.h"
#import "CoreConversions.h"
#import "DevOverlay.h"
#include "LoaderToolbox.h"
#include "LoaderToolboxGestures.h"
#import "RecoveryQuickAction.h"

using unbound::ios::jsonFromObject;
using unbound::ios::toNSString;
using unbound::ios::toStdString;

static loader::toolbox::MenuStep menuStep(NSDictionary *item, BOOL confirmed)
{
    return loader::toolbox::menuStep(jsonFromObject(item), confirmed);
}

@interface                         ToolboxViewController ()
@property (nonatomic, assign) BOOL dismissalInProgress;
@end

@implementation Toolbox

+ (void)showToolboxMenu
{
    dispatch_async(dispatch_get_main_queue(), ^{ showToolboxSheet(); });
}

@end

static loader::toolbox::ShakeMotion shakeMotion;
static NSHashTable                 *windowsWithGestures = nil;

static void addSettingsGestureToWindow(UIWindow *window)
{
    if (!windowsWithGestures)
    {
        windowsWithGestures = [NSHashTable weakObjectsHashTable];
    }

    if (![windowsWithGestures containsObject:window])
    {
        [windowsWithGestures addObject:window];

        UILongPressGestureRecognizer *longPress = [[UILongPressGestureRecognizer alloc]
            initWithTarget:[UIApplication sharedApplication]
                    action:@selector(handleThreeFingerLongPress:)];
        longPress.minimumPressDuration          = [CoreBridge toolboxHoldDuration];
        longPress.numberOfTouchesRequired       = 3;
        [window addGestureRecognizer:longPress];
    }
}

static UIImpactFeedbackGenerator *feedbackGenerator = nil;

static void triggerHapticFeedback(void)
{
    if (!feedbackGenerator)
    {
        feedbackGenerator =
            [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
    }
    [feedbackGenerator prepare];
    [feedbackGenerator impactOccurred];
}

static UIWindowScene *activeWindowScene(void)
{
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes)
    {
        if (scene.activationState == UISceneActivationStateForegroundActive &&
            [scene isKindOfClass:[UIWindowScene class]])
        {
            return (UIWindowScene *) scene;
        }
    }
    return nil;
}

static NSString *const kShakeGesture       = @"shake";
static NSString *const kThreeFingerGesture = @"three-finger";

static BOOL toolboxGestureEnabled(NSString *gesture)
{
    return [CoreBridge toolboxGestureEnabled:gesture];
}

%hook UIWindow
- (void)becomeKeyWindow
{
    %orig;
    addSettingsGestureToWindow(self);
    [DevOverlay ensureOverlayForWindow:self];
}

- (void)motionBegan:(UIEventSubtype)motion withEvent:(UIEvent *)event
{
    if (motion == UIEventSubtypeMotionShake)
    {
        shakeMotion.began([[NSDate date] timeIntervalSince1970]);
    }
    %orig;
}

- (void)motionEnded:(UIEventSubtype)motion withEvent:(UIEvent *)event
{
    if (motion == UIEventSubtypeMotionShake &&
        shakeMotion.ended([[NSDate date] timeIntervalSince1970], [] {
            return toolboxGestureEnabled(kShakeGesture);
        }) == loader::toolbox::GestureAction::Open)
    {
        triggerHapticFeedback();
        dispatch_async(dispatch_get_main_queue(), ^{ showToolboxSheet(); });
    }
    %orig;
}

%end

%hook UIApplication
%new
- (void)handleThreeFingerLongPress:(UILongPressGestureRecognizer *)gesture
{
    if (gesture.state == UIGestureRecognizerStateBegan)
    {
        if (toolboxGestureEnabled(kThreeFingerGesture))
        {
            triggerHapticFeedback();
            showToolboxSheet();
        }
    }
}
%end

@implementation ToolboxViewController

- (void)viewDidLoad
{
    [super viewDidLoad];
    [self setupMenuItems];
    [self setupSheetAndTableView];
}

- (void)setupSheetAndTableView
{
    self.view.backgroundColor = UIColor.systemGroupedBackgroundColor;
    UIView *container         = self.view;

    UILabel *titleLabel  = [[UILabel alloc] init];
    titleLabel.text      = self.menu[@"title"];
    titleLabel.font      = [UIFont systemFontOfSize:20 weight:UIFontWeightBold];
    titleLabel.textColor = UIColor.labelColor;
    titleLabel.translatesAutoresizingMaskIntoConstraints = NO;

    UIButton *closeButton = [self addCloseButtonToView:container];

    UIView *divider         = [[UIView alloc] init];
    divider.backgroundColor = [UIColor.labelColor colorWithAlphaComponent:0.08];
    divider.translatesAutoresizingMaskIntoConstraints = NO;

    self.tableView = [[UITableView alloc] initWithFrame:CGRectZero
                                                  style:UITableViewStyleInsetGrouped];
    self.tableView.translatesAutoresizingMaskIntoConstraints = NO;
    self.tableView.delegate                                  = self;
    self.tableView.dataSource                                = self;
    self.tableView.backgroundColor                           = UIColor.clearColor;
    self.tableView.separatorColor = [UIColor.labelColor colorWithAlphaComponent:0.08];
    self.tableView.separatorInset = UIEdgeInsetsMake(0, 20, 0, 20);

    [container addSubview:titleLabel];
    [container addSubview:divider];
    [container addSubview:self.tableView];

    // addCloseButtonToView: sets the close button's top constraint below the sheet grabber.
    [NSLayoutConstraint activateConstraints:@[
        [titleLabel.leadingAnchor constraintEqualToAnchor:container.leadingAnchor constant:20],
        [titleLabel.centerYAnchor constraintEqualToAnchor:closeButton.centerYAnchor],

        [divider.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
        [divider.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
        [divider.topAnchor constraintEqualToAnchor:closeButton.bottomAnchor constant:12],
        [divider.heightAnchor constraintEqualToConstant:1.0 / UIScreen.mainScreen.scale],

        [self.tableView.topAnchor constraintEqualToAnchor:divider.bottomAnchor],
        [self.tableView.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
        [self.tableView.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
        [self.tableView.bottomAnchor constraintEqualToAnchor:container.bottomAnchor],
    ]];
}

- (UIButton *)addCloseButtonToView:(UIView *)container
{
    UIButton *button                                 = [UIButton buttonWithType:UIButtonTypeSystem];
    button.tintColor                                 = UIColor.labelColor;
    button.backgroundColor                           = UIColor.clearColor;
    button.translatesAutoresizingMaskIntoConstraints = NO;

    UIImageSymbolConfiguration *cfg =
        [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightBold];
    [button setImage:[UIImage systemImageNamed:@"xmark" withConfiguration:cfg]
            forState:UIControlStateNormal];
    [button addTarget:self action:@selector(dismiss) forControlEvents:UIControlEventTouchUpInside];

    [container addSubview:button];

    [NSLayoutConstraint activateConstraints:@[
        [button.topAnchor constraintEqualToAnchor:container.topAnchor constant:16],
        [button.trailingAnchor constraintEqualToAnchor:container.trailingAnchor constant:-12],
        [button.widthAnchor constraintEqualToConstant:36],
        [button.heightAnchor constraintEqualToConstant:36],
    ]];

    return button;
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController
{
    [self finishDismissal];
}

- (void)setupMenuItems
{
    self.menu         = [CoreBridge toolboxMenu:@{
        @"openAppFolder" : @YES,
    }];
    self.menuSections = self.menu[@"sections"] ?: @[];
}

static NSString *iconForMenuItem(NSString *identifier)
{
    static NSDictionary<NSString *, NSString *> *icons = nil;
    static dispatch_once_t                       onceToken;
    dispatch_once(&onceToken, ^{
        icons = @{
            @"refetch-bundle" : @"arrow.triangle.2.circlepath",
            @"delete-bundle" : @"trash",
            @"custom-bundle" : @"link.badge.plus",
            @"wipe-plugins" : @"trash",
            @"wipe-themes" : @"trash",
            @"wipe-fonts" : @"trash",
            @"wipe-icons" : @"trash",
            @"toggle-recovery" : @"shield",
            @"factory-reset" : @"trash.fill",
            @"open-app-folder" : @"folder",
            @"launch-timings" : @"stopwatch",
            @"open-issue" : @"exclamationmark.bubble",
            @"gesture-shake" : @"iphone.gen3.radiowaves.left.and.right",
            @"gesture-three-finger" : @"hand.tap",
        };
    });
    return icons[identifier] ?: @"circle";
}

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView
{
    return self.menuSections.count;
}

- (NSString *)tableView:(UITableView *)tableView titleForHeaderInSection:(NSInteger)section
{
    return self.menuSections[section][@"title"];
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section
{
    return [self.menuSections[section][@"items"] count];
}

- (UITableViewCell *)tableView:(UITableView *)tableView
         cellForRowAtIndexPath:(NSIndexPath *)indexPath
{
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"Cell"];
    if (!cell)
    {
        cell                 = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault
                                                      reuseIdentifier:@"Cell"];
        cell.backgroundColor = UIColor.secondarySystemGroupedBackgroundColor;

        UIView *selectedBackground         = [[UIView alloc] init];
        selectedBackground.backgroundColor = [UIColor.labelColor colorWithAlphaComponent:0.12];
        cell.selectedBackgroundView        = selectedBackground;
    }

    cell.accessoryView = nil;

    NSDictionary *item = self.menuSections[indexPath.section][@"items"][indexPath.row];

    BOOL     isDestructive = [item[@"destructive"] boolValue];
    UIColor *tint          = isDestructive ? UIColor.systemRedColor : UIColor.labelColor;

    UIImageSymbolConfiguration *symbolConfig =
        [UIImageSymbolConfiguration configurationWithPointSize:18 weight:UIImageSymbolWeightMedium];
    UIImage *icon = [UIImage systemImageNamed:iconForMenuItem(item[@"id"])
                            withConfiguration:symbolConfig];

    UIListContentConfiguration *content                  = [cell defaultContentConfiguration];
    content.text                                         = item[@"title"];
    content.textProperties.font                          = [UIFont systemFontOfSize:15];
    content.textProperties.color                         = tint;
    content.image                                        = icon;
    content.imageProperties.tintColor                    = tint;
    content.imageProperties.preferredSymbolConfiguration = symbolConfig;
    content.imageProperties.reservedLayoutSize           = CGSizeMake(24, 24);
    content.imageToTextPadding                           = 14;
    cell.contentConfiguration                            = content;

    if ([item[@"kind"] isEqualToString:@"toggle"])
    {
        UISwitch *toggle               = [[UISwitch alloc] init];
        toggle.accessibilityIdentifier = item[@"id"];
        [toggle addTarget:self
                      action:@selector(toggleSetting:)
            forControlEvents:UIControlEventValueChanged];

        toggle.on = [item[@"on"] boolValue];

        cell.accessoryView = toggle;
    }

    return cell;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath
{
    [tableView deselectRowAtIndexPath:indexPath animated:YES];

    NSDictionary *item = self.menuSections[indexPath.section][@"items"][indexPath.row];

    switch (menuStep(item, NO))
    {
        case loader::toolbox::MenuStep::None:
            return;
        case loader::toolbox::MenuStep::Confirm:
            [self confirmMenuItem:item];
            return;
        default:
            [self selectMenuItem:item];
            return;
    }
}

- (void)tableView:(UITableView *)tableView
      willDisplayCell:(UITableViewCell *)cell
    forRowAtIndexPath:(NSIndexPath *)indexPath
{
    UIEdgeInsets uniformInsets           = UIEdgeInsetsMake(0, 20, 0, 20);
    cell.separatorInset                  = uniformInsets;
    cell.layoutMargins                   = uniformInsets;
    cell.preservesSuperviewLayoutMargins = NO;
}

- (void)confirmMenuItem:(NSDictionary *)item
{
    NSDictionary *confirmation = self.menu[@"confirmation"];

    UIAlertController *alert =
        [UIAlertController alertControllerWithTitle:item[@"title"]
                                            message:confirmation[@"message"]
                                     preferredStyle:UIAlertControllerStyleAlert];
    [alert addAction:[UIAlertAction actionWithTitle:confirmation[@"cancel"]
                                              style:UIAlertActionStyleCancel
                                            handler:nil]];
    [alert addAction:[UIAlertAction
                         actionWithTitle:confirmation[@"confirm"]
                                   style:UIAlertActionStyleDestructive
                                 handler:^(UIAlertAction *action) { [self selectMenuItem:item]; }]];

    [self presentViewController:alert animated:YES completion:nil];
}

- (void)selectMenuItem:(NSDictionary *)item
{
    switch (menuStep(item, YES))
    {
        case loader::toolbox::MenuStep::Platform:
            [self performPlatformMenuItem:item];
            break;
        case loader::toolbox::MenuStep::Prompt:
            [self promptForMenuItem:item];
            break;
        case loader::toolbox::MenuStep::Run:
            [self runMenuItem:item argument:item[@"argument"] ?: @""];
            break;
        default:
            break;
    }
}

- (void)performPlatformMenuItem:(NSDictionary *)item
{
    NSString *identifier = item[@"id"];

    if ([identifier isEqualToString:@"open-app-folder"])
    {
        [self openAppFolder];
    }
    else if ([identifier isEqualToString:@"open-issue"])
    {
        [self openGitHubIssue:item];
    }
    else if ([identifier isEqualToString:@"launch-timings"])
    {
        [Utilities alert:[CoreBridge toolbox:@"launch-timings" argument:@""] title:item[@"title"]];
    }
}

- (void)promptForMenuItem:(NSDictionary *)item
{
    NSDictionary      *prompt = item[@"prompt"];
    UIAlertController *alert =
        [UIAlertController alertControllerWithTitle:prompt[@"title"]
                                            message:prompt[@"message"]
                                     preferredStyle:UIAlertControllerStyleAlert];
    [alert addTextFieldWithConfigurationHandler:^(UITextField *textField) {
        textField.placeholder            = prompt[@"placeholder"];
        textField.keyboardType           = UIKeyboardTypeURL;
        textField.autocorrectionType     = UITextAutocorrectionTypeNo;
        textField.autocapitalizationType = UITextAutocapitalizationTypeNone;
    }];

    [alert addAction:[UIAlertAction actionWithTitle:prompt[@"cancel"]
                                              style:UIAlertActionStyleCancel
                                            handler:nil]];
    [alert addAction:[UIAlertAction actionWithTitle:prompt[@"confirm"]
                                              style:UIAlertActionStyleDefault
                                            handler:^(UIAlertAction *action) {
                                                [self runMenuItem:item
                                                         argument:alert.textFields.firstObject.text
                                                                      ?: @""];
                                            }]];
    [self presentViewController:alert animated:YES completion:nil];
}

- (void)runMenuItem:(NSDictionary *)item argument:(NSString *)argument
{
    UIAlertController *progress = nil;
    if (item[@"progress"])
    {
        progress = [UIAlertController alertControllerWithTitle:item[@"title"]
                                                       message:item[@"progress"]
                                                preferredStyle:UIAlertControllerStyleAlert];
        [self presentViewController:progress animated:YES completion:nil];
    }

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSString *result = [CoreBridge toolbox:item[@"action"] argument:argument];
        dispatch_async(dispatch_get_main_queue(), ^{
            void (^finish)(void) = ^{ [self finishMenuItem:item result:result]; };
            if (progress)
            {
                [progress dismissViewControllerAnimated:YES completion:finish];
                return;
            }
            finish();
        });
    });
}

- (void)finishMenuItem:(NSDictionary *)item result:(NSString *)result
{
    switch (loader::toolbox::menuOutcome(jsonFromObject(item), toStdString(result)))
    {
        case loader::toolbox::MenuOutcome::Failed:
            [Utilities alert:item[@"failure"] title:item[@"title"]];
            break;
        case loader::toolbox::MenuOutcome::Restart:
            [RecoveryQuickAction refresh];
            [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
            break;
        case loader::toolbox::MenuOutcome::Done:
            break;
    }
}

- (void)openAppFolder
{
    UIApplication           *application = [UIApplication sharedApplication];
    std::vector<std::string> urls =
        loader::toolbox::appFolderURLs(toStdString(FileSystem.documents), [Utilities isJailbroken]);

    for (size_t index = 0; index + 1 < urls.size(); index++)
    {
        NSURL *url = [NSURL URLWithString:toNSString(urls[index])];
        if ([application canOpenURL:url])
        {
            [application openURL:url options:@{} completionHandler:nil];
            return;
        }
    }

    [application openURL:[NSURL URLWithString:toNSString(urls.back())]
                  options:@{}
        completionHandler:nil];
}

- (void)openGitHubIssue:(NSDictionary *)item
{
    NSString *appVersion =
        [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    NSString *buildNumber = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
    NSString *discordVersion = toNSString(loader::toolbox::discordVersionLabel(
        appVersion ? std::optional<std::string>(toStdString(appVersion)) : std::nullopt,
        toStdString(buildNumber)));
    NSURL    *url = [NSURL URLWithString:[CoreBridge toolbox:@"issue-url" argument:discordVersion]];

    if (!url)
    {
        [Utilities alert:item[@"failure"] title:item[@"title"]];
        return;
    }

    SFSafariViewController *safari = [[SFSafariViewController alloc] initWithURL:url];
    safari.dismissButtonStyle      = SFSafariViewControllerDismissButtonStyleClose;
    safari.delegate                = self;
    safari.modalPresentationStyle  = UIModalPresentationPageSheet;
    [self presentViewController:safari animated:YES completion:nil];
}

- (UISwitch *)switchForSettingKey:(NSString *)key
{
    for (UITableViewCell *cell in self.tableView.visibleCells)
    {
        if ([cell.accessoryView isKindOfClass:[UISwitch class]] &&
            [cell.accessoryView.accessibilityIdentifier isEqualToString:key])
        {
            return (UISwitch *) cell.accessoryView;
        }
    }
    return nil;
}

- (NSDictionary *)menuItemWithIdentifier:(NSString *)identifier
{
    for (NSDictionary *section in self.menuSections)
    {
        for (NSDictionary *item in section[@"items"])
        {
            if ([item[@"id"] isEqualToString:identifier])
            {
                return item;
            }
        }
    }
    return nil;
}

- (void)toggleSetting:(UISwitch *)sender
{
    NSString     *identifier = sender.accessibilityIdentifier;
    NSDictionary *item       = [self menuItemWithIdentifier:identifier];

    if (item[@"gesture"])
    {
        [CoreBridge setToolboxGesture:item[@"gesture"] enabled:sender.on];
        [self setupMenuItems];
        for (NSDictionary *section in self.menuSections)
        {
            for (NSDictionary *entry in section[@"items"])
            {
                if (entry[@"gesture"])
                {
                    [[self switchForSettingKey:entry[@"id"]] setOn:[entry[@"on"] boolValue]
                                                          animated:YES];
                }
            }
        }
    }
}

- (void)safariViewControllerDidFinish:(SFSafariViewController *)controller
{
    [controller dismissViewControllerAnimated:YES completion:nil];
}

- (void)dismiss
{
    if (self.dismissalInProgress)
    {
        return;
    }

    self.dismissalInProgress = YES;
    [self dismissViewControllerAnimated:YES completion:^{ [self finishDismissal]; }];
}

- (void)finishDismissal
{
    UIWindow *storedWindow  = objc_getAssociatedObject(self, "recoveryTopWindow");
    UIWindow *origKeyWindow = objc_getAssociatedObject(self, "recoveryOriginalKeyWindow");

    if (storedWindow)
    {
        storedWindow.hidden             = YES;
        storedWindow.rootViewController = nil;
    }

    [origKeyWindow makeKeyAndVisible];

    objc_setAssociatedObject(self, "recoveryTopWindow", nil, OBJC_ASSOCIATION_ASSIGN);
    objc_setAssociatedObject(self, "recoveryOriginalKeyWindow", nil, OBJC_ASSOCIATION_ASSIGN);
}

void showToolboxSheet(void)
{
    ToolboxViewController *settingsVC = [[ToolboxViewController alloc] init];
    settingsVC.modalPresentationStyle = UIModalPresentationPageSheet;

    UISheetPresentationController *sheet = settingsVC.sheetPresentationController;
    sheet.detents                        = @[
        UISheetPresentationControllerDetent.mediumDetent,
        UISheetPresentationControllerDetent.largeDetent,
    ];
    sheet.prefersGrabberVisible = YES;
    // A swipe-down dismissal skips -dismiss; the delegate still tears down the top window.
    sheet.delegate = settingsVC;

    UIWindowScene *activeScene = activeWindowScene();
    if (!activeScene)
        return;

    UIWindow *originalKeyWindow = nil;
    for (UIWindow *w in activeScene.windows)
    {
        if (w.isKeyWindow)
        {
            originalKeyWindow = w;
            break;
        }
    }

    UIWindow *topWindow       = [[UIWindow alloc] initWithWindowScene:activeScene];
    topWindow.windowLevel     = UIWindowLevelAlert + 100;
    topWindow.backgroundColor = [UIColor clearColor];

    UIViewController *rootVC     = [UIViewController new];
    rootVC.view.backgroundColor  = [UIColor clearColor];
    topWindow.rootViewController = rootVC;
    [topWindow makeKeyAndVisible];

    [rootVC presentViewController:settingsVC animated:YES completion:nil];

    objc_setAssociatedObject(settingsVC, "recoveryTopWindow", topWindow,
                             OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    if (originalKeyWindow)
    {
        objc_setAssociatedObject(settingsVC, "recoveryOriginalKeyWindow", originalKeyWindow,
                                 OBJC_ASSOCIATION_ASSIGN);
    }
}

@end
