#import "Toolbox.h"

#import "CoreBridge.h"
#import "DevOverlay.h"
#import "RecoveryQuickAction.h"

@interface                         ToolboxViewController ()
@property (nonatomic, assign) BOOL dismissalInProgress;
@end

@implementation Toolbox

+ (void)showToolboxMenu
{
    dispatch_async(dispatch_get_main_queue(), ^{ showToolboxSheet(); });
}

@end

static NSTimeInterval shakeStartTime      = 0;
static BOOL           isShaking           = NO;
static NSHashTable   *windowsWithGestures = nil;

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
    return [[CoreBridge preference:@"gesture" argument:gesture] isEqualToString:@"true"];
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
        isShaking      = YES;
        shakeStartTime = [[NSDate date] timeIntervalSince1970];
    }
    %orig;
}

- (void)motionEnded:(UIEventSubtype)motion withEvent:(UIEvent *)event
{
    if (motion == UIEventSubtypeMotionShake && isShaking)
    {
        if (toolboxGestureEnabled(kShakeGesture))
        {
            NSTimeInterval currentTime   = [[NSDate date] timeIntervalSince1970];
            NSTimeInterval shakeDuration = currentTime - shakeStartTime;

            if (shakeDuration >= 0.5 && shakeDuration <= 2.0)
            {
                triggerHapticFeedback();
                dispatch_async(dispatch_get_main_queue(), ^{ showToolboxSheet(); });
            }
        }
        isShaking = NO;
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
    [self setupCardAndTableView];
}

- (void)setupCardAndTableView
{
    self.view.backgroundColor = [UIColor.blackColor colorWithAlphaComponent:0.45];

    UITapGestureRecognizer *backdropTap =
        [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(backdropTapped:)];
    backdropTap.delegate = self;
    [self.view addGestureRecognizer:backdropTap];

    UIVisualEffectView *card                       = [[UIVisualEffectView alloc]
        initWithEffect:[UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterial]];
    card.layer.cornerRadius                        = 28;
    card.layer.cornerCurve                         = kCACornerCurveContinuous;
    card.layer.masksToBounds                       = YES;
    card.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:card];
    self.cardView  = card;
    card.alpha     = 0;
    card.transform = CGAffineTransformMakeScale(0.97, 0.97);

    [NSLayoutConstraint activateConstraints:@[
        [card.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:12],
        [card.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-12],
        [card.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:8],
        [card.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor
                                          constant:-8],
    ]];

    UILabel *titleLabel  = [[UILabel alloc] init];
    titleLabel.text      = self.menu[@"title"];
    titleLabel.font      = [UIFont systemFontOfSize:20 weight:UIFontWeightBold];
    titleLabel.textColor = UIColor.labelColor;
    titleLabel.translatesAutoresizingMaskIntoConstraints = NO;

    UIButton *closeButton = [self addCloseButtonToView:card.contentView];

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

    [card.contentView addSubview:titleLabel];
    [card.contentView addSubview:divider];
    [card.contentView addSubview:self.tableView];

    [NSLayoutConstraint activateConstraints:@[
        [closeButton.topAnchor constraintEqualToAnchor:card.contentView.topAnchor constant:12],
        [closeButton.trailingAnchor constraintEqualToAnchor:card.contentView.trailingAnchor
                                                   constant:-12],
        [closeButton.widthAnchor constraintEqualToConstant:36],
        [closeButton.heightAnchor constraintEqualToConstant:36],

        [titleLabel.leadingAnchor constraintEqualToAnchor:card.contentView.leadingAnchor
                                                 constant:20],
        [titleLabel.centerYAnchor constraintEqualToAnchor:closeButton.centerYAnchor],

        [divider.leadingAnchor constraintEqualToAnchor:card.contentView.leadingAnchor],
        [divider.trailingAnchor constraintEqualToAnchor:card.contentView.trailingAnchor],
        [divider.topAnchor constraintEqualToAnchor:closeButton.bottomAnchor constant:12],
        [divider.heightAnchor constraintEqualToConstant:1.0 / UIScreen.mainScreen.scale],

        [self.tableView.topAnchor constraintEqualToAnchor:divider.bottomAnchor],
        [self.tableView.leadingAnchor constraintEqualToAnchor:card.contentView.leadingAnchor],
        [self.tableView.trailingAnchor constraintEqualToAnchor:card.contentView.trailingAnchor],
        [self.tableView.bottomAnchor constraintEqualToAnchor:card.contentView.bottomAnchor],
    ]];
}

- (void)viewDidAppear:(BOOL)animated
{
    [super viewDidAppear:animated];
    [UIView animateWithDuration:0.2
                          delay:0
         usingSpringWithDamping:0.9
          initialSpringVelocity:0.2
                        options:UIViewAnimationOptionCurveEaseOut
                     animations:^{
                         self.cardView.alpha     = 1;
                         self.cardView.transform = CGAffineTransformIdentity;
                     }
                     completion:nil];
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
        [button.topAnchor constraintEqualToAnchor:container.topAnchor constant:12],
        [button.trailingAnchor constraintEqualToAnchor:container.trailingAnchor constant:-12],
        [button.widthAnchor constraintEqualToConstant:36],
        [button.heightAnchor constraintEqualToConstant:36],
    ]];

    return button;
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
       shouldReceiveTouch:(UITouch *)touch
{
    CGPoint point = [touch locationInView:self.view];
    return !CGRectContainsPoint(self.cardView.frame, point);
}

- (void)backdropTapped:(UITapGestureRecognizer *)gesture
{
    [self dismiss];
}

- (void)setupMenuItems
{
    self.menu         = [CoreBridge toolboxMenu:@{
        @"openAppFolder" : @YES,
        @"unboundIcon" : @(![Utilities hasDiscordProductionEntitlements]),
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
            @"open-issue" : @"exclamationmark.bubble",
            @"gesture-shake" : @"iphone.gen3.radiowaves.left.and.right",
            @"gesture-three-finger" : @"hand.tap",
            @"unbound-icon" : @"app.badge",
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
        cell.backgroundColor = [UIColor.labelColor colorWithAlphaComponent:0.05];

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

        if ([item[@"id"] isEqualToString:@"unbound-icon"])
        {
            NSString *currentIcon = [[UIApplication sharedApplication] alternateIconName];
            toggle.on             = [currentIcon isEqualToString:@"UnboundIcon"];
        }
        else
        {
            toggle.on = [item[@"on"] boolValue];
        }

        cell.accessoryView = toggle;
    }

    return cell;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath
{
    [tableView deselectRowAtIndexPath:indexPath animated:YES];

    NSDictionary *item = self.menuSections[indexPath.section][@"items"][indexPath.row];

    if ([item[@"kind"] isEqualToString:@"toggle"])
    {
        return;
    }

    if ([item[@"destructive"] boolValue])
    {
        [self confirmMenuItem:item];
    }
    else
    {
        [self selectMenuItem:item];
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
    if ([item[@"kind"] isEqualToString:@"platform"])
    {
        [self performPlatformMenuItem:item];
    }
    else if (item[@"prompt"])
    {
        [self promptForMenuItem:item];
    }
    else
    {
        [self runMenuItem:item argument:item[@"argument"] ?: @""];
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
    if (item[@"failure"] && ![result isEqualToString:@"true"])
    {
        [Utilities alert:item[@"failure"] title:item[@"title"]];
        return;
    }

    if ([item[@"restartsApp"] boolValue])
    {
        [RecoveryQuickAction refresh];
        [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
    }
}

- (void)openAppFolder
{
    if ([Utilities isJailbroken])
    {
        NSString *filePath = [NSString stringWithFormat:@"filza://view%@", FileSystem.documents];
        NSURL    *url      = [NSURL URLWithString:filePath];

        if ([[UIApplication sharedApplication] canOpenURL:url])
        {
            [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
            return;
        }
    }

    NSString *sharedPath =
        [NSString stringWithFormat:@"shareddocuments://%@", FileSystem.documents];
    NSURL *sharedUrl = [NSURL URLWithString:sharedPath];

    [[UIApplication sharedApplication] openURL:sharedUrl options:@{} completionHandler:nil];
}

- (void)openGitHubIssue:(NSDictionary *)item
{
    NSString *appVersion =
        [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    NSString *buildNumber = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
    NSString *discordVersion =
        appVersion ? [NSString stringWithFormat:@"%@ (%@)", appVersion, buildNumber ?: @""] : @"";
    NSURL *url = [NSURL URLWithString:[CoreBridge toolbox:@"issue-url" argument:discordVersion]];

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
        [CoreBridge preference:@"set-gesture"
                      argument:[NSString stringWithFormat:@"%@=%@", item[@"gesture"],
                                                          sender.on ? @"true" : @"false"]];
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
    else if ([identifier isEqualToString:@"unbound-icon"])
    {
        NSString *iconName = sender.on ? @"UnboundIcon" : nil;

        [[UIApplication sharedApplication] setAlternateIconName:iconName
                                              completionHandler:^(NSError *error) {
                                                  if (error)
                                                  {
                                                      dispatch_async(dispatch_get_main_queue(), ^{
                                                          [sender setOn:!sender.on animated:YES];
                                                      });
                                                  }
                                              }];
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
    [UIView animateWithDuration:0.16
        animations:^{
            self.cardView.alpha       = 0;
            self.cardView.transform   = CGAffineTransformMakeScale(0.97, 0.97);
            self.view.backgroundColor = UIColor.clearColor;
        }
        completion:^(BOOL finished) {
            [self dismissViewControllerAnimated:NO completion:^{ [self finishDismissal]; }];
        }];
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
    settingsVC.modalPresentationStyle = UIModalPresentationOverFullScreen;
    settingsVC.modalTransitionStyle   = UIModalTransitionStyleCrossDissolve;

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
