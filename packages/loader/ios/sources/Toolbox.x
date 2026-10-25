#import "CoreBridge.h"
#import "Toolbox.h"
#import "DevOverlay.h"
#import "RecoveryQuickAction.h"

@interface ToolboxViewController ()
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
        longPress.minimumPressDuration          = 0.5;
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

    UIVisualEffectView *card = [[UIVisualEffectView alloc]
        initWithEffect:[UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterial]];
    card.layer.cornerRadius                        = 28;
    card.layer.cornerCurve                         = kCACornerCurveContinuous;
    card.layer.masksToBounds                       = YES;
    card.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:card];
    self.cardView = card;
    card.alpha = 0;
    card.transform = CGAffineTransformMakeScale(0.97, 0.97);

    [NSLayoutConstraint activateConstraints:@[
        [card.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:12],
        [card.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-12],
        [card.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor
                                        constant:8],
        [card.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor
                                           constant:-8],
    ]];

    UILabel *titleLabel                                    = [[UILabel alloc] init];
    titleLabel.text                                        = @"Unbound Toolbox";
    titleLabel.font                                        = [UIFont systemFontOfSize:20
                                                    weight:UIFontWeightBold];
    titleLabel.textColor                                   = UIColor.labelColor;
    titleLabel.translatesAutoresizingMaskIntoConstraints    = NO;

    UIButton *closeButton = [self addCloseButtonToView:card.contentView];

    UIView *divider                                     = [[UIView alloc] init];
    divider.backgroundColor                             = [UIColor.labelColor colorWithAlphaComponent:0.08];
    divider.translatesAutoresizingMaskIntoConstraints    = NO;

    self.tableView = [[UITableView alloc] initWithFrame:CGRectZero
                                                  style:UITableViewStyleInsetGrouped];
    self.tableView.translatesAutoresizingMaskIntoConstraints = NO;
    self.tableView.delegate                                  = self;
    self.tableView.dataSource                                = self;
    self.tableView.backgroundColor                           = UIColor.clearColor;
    self.tableView.separatorColor = [UIColor.labelColor colorWithAlphaComponent:0.08];
    self.tableView.separatorInset                            = UIEdgeInsetsMake(0, 20, 0, 20);

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
                         self.cardView.alpha = 1;
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
    NSMutableArray *settingsItems =
        [NSMutableArray arrayWithObjects:@{
            @"title" : @"Enable Shake Motion",
            @"icon" : @"iphone.gen3.radiowaves.left.and.right",
            @"isSwitch" : @YES,
            @"key" : kShakeGesture
        },
                                         @{
                                             @"title" : @"Enable Three Finger Press",
                                             @"icon" : @"hand.tap",
                                             @"isSwitch" : @YES,
                                             @"key" : kThreeFingerGesture
                                         },
                                         nil];

    if (![Utilities hasDiscordProductionEntitlements])
    {
        [settingsItems addObject:@{
            @"title" : @"Use Unbound Icon",
            @"icon" : @"app.badge",
            @"isSwitch" : @YES,
            @"key" : @"UnboundAppIconEnabled"
        }];
    }

    self.menuSections = @[
        @{
            @"title" : @"Bundle",
            @"items" : @[
                @{
                    @"title" : @"Refetch Bundle",
                    @"icon" : @"arrow.triangle.2.circlepath",
                    @"selector" : NSStringFromSelector(@selector(refetchBundle))
                },
                @{
                    @"title" : @"Delete Bundle",
                    @"icon" : @"trash",
                    @"destructive" : @YES,
                    @"selector" : NSStringFromSelector(@selector(deleteBundle))
                },
                @{
                    @"title" : @"Load Custom Bundle",
                    @"icon" : @"link.badge.plus",
                    @"selector" : NSStringFromSelector(@selector(loadCustomBundle))
                }
            ]
        },
        @{
            @"title" : @"Addons",
            @"items" : @[
                @{
                    @"title" : @"Wipe Plugins",
                    @"icon" : @"trash",
                    @"destructive" : @YES,
                    @"selector" : NSStringFromSelector(@selector(wipePlugins))
                },
                @{
                    @"title" : @"Wipe Themes",
                    @"icon" : @"trash",
                    @"destructive" : @YES,
                    @"selector" : NSStringFromSelector(@selector(wipeThemes))
                },
                @{
                    @"title" : @"Wipe Fonts",
                    @"icon" : @"trash",
                    @"destructive" : @YES,
                    @"selector" : NSStringFromSelector(@selector(wipeFonts))
                },
                @{
                    @"title" : @"Wipe Icon Packs",
                    @"icon" : @"trash",
                    @"destructive" : @YES,
                    @"selector" : NSStringFromSelector(@selector(wipeIconPacks))
                }
            ]
        },
        @{
            @"title" : @"Utilities",
            @"items" : @[
                @{
                    @"title" : [Utilities isRecoveryModeEnabled] ? @"Disable Recovery Mode"
                                                                 : @"Enable Recovery Mode",
                    @"icon" : @"shield",
                    @"selector" : NSStringFromSelector(@selector(toggleRecoveryMode))
                },
                @{
                    @"title" : @"Factory Reset",
                    @"icon" : @"trash.fill",
                    @"destructive" : @YES,
                    @"selector" : NSStringFromSelector(@selector(factoryReset))
                },
                @{
                    @"title" : @"Open App Folder",
                    @"icon" : @"folder",
                    @"selector" : NSStringFromSelector(@selector(openAppFolder))
                },
                @{
                    @"title" : @"Open GitHub Issue",
                    @"icon" : @"exclamationmark.bubble",
                    @"selector" : NSStringFromSelector(@selector(openGitHubIssue))
                }
            ]
        },
        @{@"title" : @"Settings", @"items" : settingsItems}
    ];
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
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault
                                      reuseIdentifier:@"Cell"];
        cell.backgroundColor = [UIColor.labelColor colorWithAlphaComponent:0.05];

        UIView *selectedBackground       = [[UIView alloc] init];
        selectedBackground.backgroundColor = [UIColor.labelColor colorWithAlphaComponent:0.12];
        cell.selectedBackgroundView        = selectedBackground;
    }

    cell.accessoryView = nil;

    NSDictionary *item = self.menuSections[indexPath.section][@"items"][indexPath.row];

    BOOL isDestructive = [item[@"destructive"] boolValue];
    UIColor *tint      = isDestructive ? UIColor.systemRedColor : UIColor.labelColor;

    UIImageSymbolConfiguration *symbolConfig =
        [UIImageSymbolConfiguration configurationWithPointSize:18 weight:UIImageSymbolWeightMedium];
    UIImage *icon = [UIImage systemImageNamed:item[@"icon"] withConfiguration:symbolConfig];

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

    if ([item[@"isSwitch"] boolValue])
    {
        UISwitch *toggle              = [[UISwitch alloc] init];
        toggle.accessibilityIdentifier = item[@"key"];
        [toggle addTarget:self
                      action:@selector(toggleSetting:)
            forControlEvents:UIControlEventValueChanged];

        if ([item[@"key"] isEqualToString:@"UnboundAppIconEnabled"])
        {
            NSString *currentIcon = [[UIApplication sharedApplication] alternateIconName];
            toggle.on             = [currentIcon isEqualToString:@"UnboundIcon"];
        }
        else
        {
            toggle.on = toolboxGestureEnabled(item[@"key"]);
        }

        cell.accessoryView = toggle;
    }

    return cell;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath
{
    [tableView deselectRowAtIndexPath:indexPath animated:YES];

    NSDictionary *item = self.menuSections[indexPath.section][@"items"][indexPath.row];

    if ([item[@"destructive"] boolValue])
    {
        [self showDestructiveConfirmation:item[@"title"] selectorName:item[@"selector"]];
    }
    else if (item[@"selector"])
    {
        [self executeActionWithSelectorName:item[@"selector"]];
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

- (void)showDestructiveConfirmation:(NSString *)action selectorName:(NSString *)selectorName
{
    NSString *message = @"Are you sure you want to do this?";

    UIAlertController *alert =
        [UIAlertController alertControllerWithTitle:action
                                            message:message
                                     preferredStyle:UIAlertControllerStyleAlert];
    [alert addAction:[UIAlertAction actionWithTitle:@"Cancel"
                                              style:UIAlertActionStyleCancel
                                            handler:nil]];
    [alert addAction:[UIAlertAction actionWithTitle:@"Confirm"
                                              style:UIAlertActionStyleDestructive
                                            handler:^(UIAlertAction *action) {
                                                [self executeActionWithSelectorName:selectorName];
                                            }]];

    [self presentViewController:alert animated:YES completion:nil];
}

- (void)executeActionWithSelectorName:(NSString *)selectorName
{
    SEL selector = NSSelectorFromString(selectorName);
    if ([self respondsToSelector:selector])
    {
        IMP imp               = [self methodForSelector:selector];
        void (*func)(id, SEL) = (void *) imp;
        func(self, selector);
    }
}

- (void)toggleRecoveryMode
{
    [RecoveryQuickAction toggleSafeMode];
    [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
}

- (void)refetchBundle
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        BOOL downloaded = [CoreBridge toolboxSucceeded:@"refetch-bundle" argument:@""];
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!downloaded)
            {
                [Utilities alert:[CoreBridge toolboxMessage:@"refetch-failed"] title:@"Refetch Bundle"];
                return;
            }
            [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
        });
    });
}

- (void)deleteBundle
{
    [CoreBridge toolbox:@"delete-bundle" argument:@""];
    [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
}

- (void)loadCustomBundle
{
    UIAlertController *alert = [UIAlertController
        alertControllerWithTitle:@"Custom Bundle URL"
                         message:@"Enter the URL to download a custom bundle from"
                  preferredStyle:UIAlertControllerStyleAlert];
    [alert addTextFieldWithConfigurationHandler:^(UITextField *textField) {
        textField.placeholder            = @"https://example.com/unbound.bundle";
        textField.keyboardType           = UIKeyboardTypeURL;
        textField.autocorrectionType     = UITextAutocorrectionTypeNo;
        textField.autocapitalizationType = UITextAutocapitalizationTypeNone;
    }];

    [alert addAction:[UIAlertAction actionWithTitle:@"Cancel"
                                              style:UIAlertActionStyleCancel
                                            handler:nil]];

    [alert
        addAction:[UIAlertAction
                      actionWithTitle:@"Download"
                                style:UIAlertActionStyleDefault
                              handler:^(UIAlertAction *action) {
                                  UITextField *textField = alert.textFields.firstObject;
                                  NSString    *urlString = textField.text;

                                  if (![CoreBridge toolboxSucceeded:@"custom-bundle" argument:urlString ?: @""])
                                  {
                                      [Utilities alert:[CoreBridge toolboxMessage:@"custom-bundle-invalid"]
                                                 title:@"Custom Bundle URL"];
                                      return;
                                  }
                                  [self dismissViewControllerAnimated:YES
                                                              completion:^{
                                                                  [Utilities reloadApp];
                                                              }];
                              }]];
    [self presentViewController:alert animated:YES completion:nil];
}

- (void)wipePlugins
{
    [CoreBridge toolbox:@"wipe" argument:@"Plugins"];
    [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
}

- (void)wipeThemes
{
    [CoreBridge toolbox:@"wipe" argument:@"Themes"];
    [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
}

- (void)wipeFonts
{
    [CoreBridge toolbox:@"wipe" argument:@"Fonts"];
    [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
}

- (void)wipeIconPacks
{
    [CoreBridge toolbox:@"wipe" argument:@"Icons"];
    [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
}

- (void)factoryReset
{
    [CoreBridge toolbox:@"factory-reset" argument:@""];
    [self dismissViewControllerAnimated:YES completion:^{ [Utilities reloadApp]; }];
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

- (void)openGitHubIssue
{
    NSString *appVersion =
        [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    NSString *buildNumber = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];

    NSDictionary *facts = @{
        @"device" : [Utilities getDeviceModel] ?: @"",
        @"osVersion" : [Utilities getiOSVersionString] ?: @"",
        @"discordVersion" : [NSString stringWithFormat:@"%@ (%@)", appVersion, buildNumber],
        @"unboundVersion" : PACKAGE_VERSION,
        @"appSource" : [Utilities getAppSource] ?: @"",
        @"registration" : [Utilities isSystemApp] ? @"System" : @"User",
        @"virtualDevice" : @([Utilities isVPhone]),
    };

    NSMutableArray<NSArray<NSString *> *> *attachments  = [NSMutableArray array];
    NSDictionary                          *entitlements = [Utilities getApplicationEntitlements];
    if (entitlements && entitlements.count > 0)
    {
        NSString *plist = [Utilities formatEntitlementsAsPlist:entitlements];
        [attachments addObject:@[ @"Entitlements", plist ]];
    }

    NSData   *request   = [NSJSONSerialization dataWithJSONObject:@{@"facts" : facts, @"attachments" : attachments}
                                                         options:0
                                                           error:nil];
    NSString *urlString = [CoreBridge toolbox:@"issue-url"
                                     argument:[[NSString alloc] initWithData:request ?: [NSData data]
                                                                    encoding:NSUTF8StringEncoding] ?: @"{}"];
    NSURL    *url       = [NSURL URLWithString:urlString];

    if (!url)
    {
        [Utilities alert:@"Failed to create GitHub issue URL" title:@"Error"];
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

- (void)toggleSetting:(UISwitch *)sender
{
    NSString *key = sender.accessibilityIdentifier;

    if ([key isEqualToString:kShakeGesture] || [key isEqualToString:kThreeFingerGesture])
    {
        [CoreBridge preference:@"set-gesture"
                      argument:[NSString stringWithFormat:@"%@=%@", key, sender.on ? @"true" : @"false"]];
        for (NSString *gesture in @[ kShakeGesture, kThreeFingerGesture ])
        {
            [[self switchForSettingKey:gesture] setOn:toolboxGestureEnabled(gesture) animated:YES];
        }
    }
    else if ([key isEqualToString:@"UnboundAppIconEnabled"])
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
            self.cardView.alpha = 0;
            self.cardView.transform = CGAffineTransformMakeScale(0.97, 0.97);
            self.view.backgroundColor = UIColor.clearColor;
        }
        completion:^(BOOL finished) {
            [self dismissViewControllerAnimated:NO completion:^{ [self finishDismissal]; }];
        }];
}

- (void)finishDismissal
{
    UIWindow *storedWindow = objc_getAssociatedObject(self, "recoveryTopWindow");
    UIWindow *origKeyWindow = objc_getAssociatedObject(self, "recoveryOriginalKeyWindow");

    if (storedWindow)
    {
        storedWindow.hidden = YES;
        storedWindow.rootViewController = nil;
    }

    [origKeyWindow makeKeyAndVisible];

    objc_setAssociatedObject(self, "recoveryTopWindow", nil, OBJC_ASSOCIATION_ASSIGN);
    objc_setAssociatedObject(self, "recoveryOriginalKeyWindow", nil,
                             OBJC_ASSOCIATION_ASSIGN);
}

void showToolboxSheet(void)
{
    ToolboxViewController *settingsVC = [[ToolboxViewController alloc] init];
    settingsVC.modalPresentationStyle        = UIModalPresentationOverFullScreen;
    settingsVC.modalTransitionStyle          = UIModalTransitionStyleCrossDissolve;

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
