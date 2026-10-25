#import "DevOverlay.h"

#import "CoreBridge.h"

@interface DevOverlayPassthroughWindow : UIWindow
@end

@implementation DevOverlayPassthroughWindow
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
    UIView *hitView = [super hitTest:point withEvent:event];
    return hitView == self.rootViewController.view ? nil : hitView;
}
@end

@interface DevOverlaySettingsEditorViewController : UIViewController <UIGestureRecognizerDelegate>
@property (nonatomic, copy) NSDictionary *model;
@property (nonatomic, strong) UIView     *cardView;
@property (nonatomic, strong) UITextView *textView;
@property (nonatomic, strong) UILabel    *errorLabel;
@end

@implementation DevOverlaySettingsEditorViewController

- (void)viewDidLoad
{
    [super viewDidLoad];
    [self setupCard];
}

- (void)setupCard
{
    self.view.backgroundColor = [UIColor.blackColor colorWithAlphaComponent:0.45];

    UITapGestureRecognizer *backdropTap =
        [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(cancelTapped)];
    backdropTap.delegate = self;
    [self.view addGestureRecognizer:backdropTap];

    UIVisualEffectView *card                       = [[UIVisualEffectView alloc]
        initWithEffect:[UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterial]];
    card.layer.cornerRadius                        = 28;
    card.layer.cornerCurve                         = kCACornerCurveContinuous;
    card.layer.masksToBounds                       = YES;
    card.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:card];
    self.cardView = card;

    [NSLayoutConstraint activateConstraints:@[
        [card.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:12],
        [card.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-12],
        [card.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:8],
        [card.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor
                                          constant:-8],
    ]];

    UILabel *titleLabel  = [[UILabel alloc] init];
    titleLabel.text      = self.model[@"title"];
    titleLabel.font      = [UIFont systemFontOfSize:20 weight:UIFontWeightBold];
    titleLabel.textColor = UIColor.labelColor;
    titleLabel.translatesAutoresizingMaskIntoConstraints = NO;

    UIButton *closeButton = [self addCircleButtonWithSystemImage:@"xmark"
                                                          action:@selector(cancelTapped)
                                                          toView:card.contentView];

    UIButton *saveButton = [UIButton buttonWithType:UIButtonTypeSystem];
    [saveButton setTitle:self.model[@"save"] forState:UIControlStateNormal];
    saveButton.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
    saveButton.tintColor       = UIColor.systemBlueColor;
    saveButton.translatesAutoresizingMaskIntoConstraints = NO;
    [saveButton addTarget:self
                   action:@selector(saveTapped)
         forControlEvents:UIControlEventTouchUpInside];

    UIView *divider         = [[UIView alloc] init];
    divider.backgroundColor = [UIColor.labelColor colorWithAlphaComponent:0.08];
    divider.translatesAutoresizingMaskIntoConstraints = NO;

    self.errorLabel                                           = [[UILabel alloc] init];
    self.errorLabel.textColor                                 = UIColor.systemRedColor;
    self.errorLabel.font                                      = [UIFont systemFontOfSize:12];
    self.errorLabel.numberOfLines                             = 2;
    self.errorLabel.hidden                                    = YES;
    self.errorLabel.translatesAutoresizingMaskIntoConstraints = NO;

    self.textView                 = [[UITextView alloc] init];
    self.textView.backgroundColor = UIColor.clearColor;
    self.textView.font      = [UIFont monospacedSystemFontOfSize:13 weight:UIFontWeightRegular];
    self.textView.textColor = UIColor.labelColor;
    self.textView.autocorrectionType     = UITextAutocorrectionTypeNo;
    self.textView.autocapitalizationType = UITextAutocapitalizationTypeNone;
    self.textView.smartQuotesType        = UITextSmartQuotesTypeNo;
    self.textView.smartDashesType        = UITextSmartDashesTypeNo;
    self.textView.keyboardType           = UIKeyboardTypeASCIICapable;
    self.textView.text                   = [CoreBridge toolbox:@"settings" argument:@""];
    self.textView.translatesAutoresizingMaskIntoConstraints = NO;

    [card.contentView addSubview:titleLabel];
    [card.contentView addSubview:saveButton];
    [card.contentView addSubview:divider];
    [card.contentView addSubview:self.errorLabel];
    [card.contentView addSubview:self.textView];

    [NSLayoutConstraint activateConstraints:@[
        [closeButton.centerYAnchor constraintEqualToAnchor:titleLabel.centerYAnchor],
        [saveButton.trailingAnchor constraintEqualToAnchor:closeButton.leadingAnchor constant:-8],
        [saveButton.centerYAnchor constraintEqualToAnchor:titleLabel.centerYAnchor],

        [titleLabel.leadingAnchor constraintEqualToAnchor:card.contentView.leadingAnchor
                                                 constant:20],

        [divider.leadingAnchor constraintEqualToAnchor:card.contentView.leadingAnchor],
        [divider.trailingAnchor constraintEqualToAnchor:card.contentView.trailingAnchor],
        [divider.topAnchor constraintEqualToAnchor:closeButton.bottomAnchor constant:12],
        [divider.heightAnchor constraintEqualToConstant:1.0 / UIScreen.mainScreen.scale],

        [self.errorLabel.leadingAnchor constraintEqualToAnchor:card.contentView.leadingAnchor
                                                      constant:20],
        [self.errorLabel.trailingAnchor constraintEqualToAnchor:card.contentView.trailingAnchor
                                                       constant:-20],
        [self.errorLabel.topAnchor constraintEqualToAnchor:divider.bottomAnchor constant:8],

        [self.textView.topAnchor constraintEqualToAnchor:self.errorLabel.bottomAnchor constant:4],
        [self.textView.leadingAnchor constraintEqualToAnchor:card.contentView.leadingAnchor
                                                    constant:12],
        [self.textView.trailingAnchor constraintEqualToAnchor:card.contentView.trailingAnchor
                                                     constant:-12],
        [self.textView.bottomAnchor constraintEqualToAnchor:card.contentView.bottomAnchor
                                                   constant:-12],
    ]];
}

- (UIButton *)addCircleButtonWithSystemImage:(NSString *)imageName
                                      action:(SEL)action
                                      toView:(UIView *)container
{
    UIView *backdrop                                   = [[UIView alloc] init];
    backdrop.translatesAutoresizingMaskIntoConstraints = NO;
    backdrop.layer.cornerRadius                        = 18;
    backdrop.layer.cornerCurve                         = kCACornerCurveContinuous;
    backdrop.layer.masksToBounds                       = YES;
    backdrop.userInteractionEnabled                    = NO;

    UIVisualEffectView *blur                       = [[UIVisualEffectView alloc]
        initWithEffect:[UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterial]];
    blur.translatesAutoresizingMaskIntoConstraints = NO;
    [backdrop addSubview:blur];

    UIButton *button                                 = [UIButton buttonWithType:UIButtonTypeSystem];
    button.tintColor                                 = UIColor.labelColor;
    button.backgroundColor                           = UIColor.clearColor;
    button.translatesAutoresizingMaskIntoConstraints = NO;

    UIImageSymbolConfiguration *cfg =
        [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightBold];
    [button setImage:[UIImage systemImageNamed:imageName withConfiguration:cfg]
            forState:UIControlStateNormal];
    [button addTarget:self action:action forControlEvents:UIControlEventTouchUpInside];

    [container addSubview:backdrop];
    [container addSubview:button];

    [NSLayoutConstraint activateConstraints:@[
        [blur.topAnchor constraintEqualToAnchor:backdrop.topAnchor],
        [blur.leadingAnchor constraintEqualToAnchor:backdrop.leadingAnchor],
        [blur.trailingAnchor constraintEqualToAnchor:backdrop.trailingAnchor],
        [blur.bottomAnchor constraintEqualToAnchor:backdrop.bottomAnchor],

        [backdrop.topAnchor constraintEqualToAnchor:container.topAnchor constant:12],
        [backdrop.trailingAnchor constraintEqualToAnchor:container.trailingAnchor constant:-12],
        [backdrop.widthAnchor constraintEqualToConstant:36],
        [backdrop.heightAnchor constraintEqualToConstant:36],

        [button.topAnchor constraintEqualToAnchor:backdrop.topAnchor],
        [button.leadingAnchor constraintEqualToAnchor:backdrop.leadingAnchor],
        [button.trailingAnchor constraintEqualToAnchor:backdrop.trailingAnchor],
        [button.bottomAnchor constraintEqualToAnchor:backdrop.bottomAnchor],
    ]];

    return button;
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
       shouldReceiveTouch:(UITouch *)touch
{
    CGPoint point = [touch locationInView:self.view];
    return !CGRectContainsPoint(self.cardView.frame, point);
}

- (void)cancelTapped
{
    [self dismissViewControllerAnimated:YES completion:nil];
}

- (void)saveTapped
{
    [self.view endEditing:YES];

    NSDictionary *result = [CoreBridge toolboxObject:@"save-settings" argument:self.textView.text];
    if (![result[@"saved"] boolValue])
    {
        self.errorLabel.text   = result[@"error"];
        self.errorLabel.hidden = NO;
        return;
    }

    [[NSNotificationCenter defaultCenter] postNotificationName:SettingsDidChangeNotification
                                                        object:nil];
    [self dismissViewControllerAnimated:YES completion:nil];
}

@end

@implementation DevOverlay

static UIWindow *devOverlayWindow   = nil;
static UIButton *devOverlayButton   = nil;
static UIView   *devOverlayBackdrop = nil;

static UIWindow *discordKeyWindow = nil;

static CGPoint devOverlayButtonCenter    = {0, 0};
static CGPoint devOverlayDragStartCenter = {0, 0};

+ (void)initialize
{
    if (self != [DevOverlay class])
        return;

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(settingsDidChange:)
                                                 name:SettingsDidChangeNotification
                                               object:nil];
}

+ (BOOL)shouldShowOverlay
{
#ifdef DEBUG
    BOOL debugBuild = YES;
#else
    BOOL debugBuild = NO;
#endif
    NSMutableArray<NSString *> *flags = [NSMutableArray array];
    if ([Utilities isVPhone])
        [flags addObject:@"virtual-device"];
    if (debugBuild)
        [flags addObject:@"debug-build"];
    return [[CoreBridge preference:@"dev-overlay"
                          argument:[flags componentsJoinedByString:@","]] isEqualToString:@"true"];
}

+ (UIWindowScene *)activeWindowScene
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

+ (UIWindow *)activeKeyWindow
{
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes)
    {
        if (![scene isKindOfClass:[UIWindowScene class]])
        {
            continue;
        }

        for (UIWindow *window in ((UIWindowScene *) scene).windows)
        {
            if (window.isKeyWindow)
            {
                return window;
            }
        }
    }

    return nil;
}

+ (void)removeOverlay
{
    devOverlayButton                    = nil;
    devOverlayBackdrop                  = nil;
    devOverlayWindow.hidden             = YES;
    devOverlayWindow.rootViewController = nil;
    devOverlayWindow                    = nil;
}

+ (void)refreshOverlay
{
    if ([self shouldShowOverlay])
    {
        UIWindow *window = discordKeyWindow ?: [self activeKeyWindow];
        if (window)
        {
            [self ensureOverlayForWindow:window];
        }
        return;
    }

    [self removeOverlay];
}

+ (void)settingsDidChange:(NSNotification *)notification
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [self refreshOverlay];
        [ChatUI reloadPreferences];
    });
}

+ (void)ensureOverlayForWindow:(UIWindow *)keyWindow
{
    if (![self shouldShowOverlay] || devOverlayWindow)
    {
        return;
    }

    discordKeyWindow = keyWindow;

    UIWindowScene *activeScene = keyWindow.windowScene ?: [self activeWindowScene];
    if (!activeScene)
    {
        return;
    }

    DevOverlayPassthroughWindow *overlayWindow =
        [[DevOverlayPassthroughWindow alloc] initWithWindowScene:activeScene];
    overlayWindow.windowLevel     = UIWindowLevelAlert - 1;
    overlayWindow.backgroundColor = [UIColor clearColor];

    UIView *passthroughView         = [[UIView alloc] init];
    passthroughView.backgroundColor = [UIColor clearColor];

    UIViewController *rootVC         = [UIViewController new];
    rootVC.view                      = passthroughView;
    overlayWindow.rootViewController = rootVC;

    overlayWindow.hidden = NO;

    devOverlayWindow       = overlayWindow;
    devOverlayButtonCenter = [CoreBridge devOverlayCenterInBounds:activeScene.screen.bounds.size
                                                           insets:keyWindow.safeAreaInsets];

    overlayWindow.frame = [self collapsedFrame];
    [overlayWindow layoutIfNeeded];

    const CGFloat side = [CoreBridge devOverlayButtonSide];

    UIView *backdrop                = [[UIView alloc] init];
    backdrop.layer.cornerRadius     = side / 2.0;
    backdrop.layer.cornerCurve      = kCACornerCurveContinuous;
    backdrop.layer.masksToBounds    = YES;
    backdrop.layer.borderWidth      = 1.0 / UIScreen.mainScreen.scale;
    backdrop.layer.borderColor      = [UIColor.labelColor colorWithAlphaComponent:0.18].CGColor;
    backdrop.userInteractionEnabled = NO;

    UIVisualEffectView *blur = [[UIVisualEffectView alloc]
        initWithEffect:[UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterial]];
    blur.frame               = CGRectMake(0, 0, side, side);
    blur.autoresizingMask    = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [backdrop addSubview:blur];

    [rootVC.view addSubview:backdrop];

    UIButton *button       = [UIButton buttonWithType:UIButtonTypeSystem];
    button.tintColor       = UIColor.labelColor;
    button.backgroundColor = UIColor.clearColor;

    UIImageSymbolConfiguration *symbolConfig =
        [UIImageSymbolConfiguration configurationWithPointSize:15
                                                        weight:UIImageSymbolWeightRegular];
    [button setImage:[UIImage systemImageNamed:@"wrench" withConfiguration:symbolConfig]
            forState:UIControlStateNormal];
    [button addTarget:self
                  action:@selector(showDeveloperMenu)
        forControlEvents:UIControlEventTouchUpInside];

    UIPanGestureRecognizer *pan =
        [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handleButtonPan:)];
    [button addGestureRecognizer:pan];

    [rootVC.view addSubview:button];

    devOverlayBackdrop = backdrop;
    devOverlayButton   = button;

    [self applyButtonPosition];
}

#pragma mark - Button placement

+ (CGRect)screenBounds
{
    UIWindowScene *scene = devOverlayWindow.windowScene ?: [self activeWindowScene];
    return scene ? scene.screen.bounds : UIScreen.mainScreen.bounds;
}

+ (void)persistButtonCenter
{
    [CoreBridge saveDevOverlayCenter:devOverlayButtonCenter bounds:[self screenBounds].size];
}

+ (CGPoint)clampedCenter:(CGPoint)center
{
    return [CoreBridge clampDevOverlayCenter:center
                                      bounds:[self screenBounds].size
                                      insets:discordKeyWindow.safeAreaInsets];
}

+ (CGRect)buttonFrameInScreen
{
    CGFloat side = [CoreBridge devOverlayButtonSide];
    return CGRectMake(devOverlayButtonCenter.x - side / 2.0, devOverlayButtonCenter.y - side / 2.0,
                      side, side);
}

+ (CGRect)collapsedFrame
{
    CGFloat margin  = [CoreBridge devOverlayButtonMargin];
    CGRect  padded  = CGRectInset([self buttonFrameInScreen], -margin, -margin);
    CGRect  clipped = CGRectIntersection(padded, [self screenBounds]);
    return CGRectIsNull(clipped) ? padded : clipped;
}

+ (void)applyButtonPosition
{
    if (!devOverlayWindow || !devOverlayButton)
        return;

    CGPoint origin      = devOverlayWindow.frame.origin;
    CGRect  buttonFrame = CGRectOffset([self buttonFrameInScreen], -origin.x, -origin.y);

    devOverlayButton.frame   = buttonFrame;
    devOverlayBackdrop.frame = buttonFrame;
}

+ (void)growOverlayWindow
{
    UIWindowScene *scene = devOverlayWindow.windowScene;
    if (!scene)
        return;

    devOverlayWindow.frame = scene.screen.bounds;
    [devOverlayWindow layoutIfNeeded];
    [self applyButtonPosition];
}

+ (void)shrinkOverlayWindow
{
    if (!devOverlayWindow)
        return;

    devOverlayButtonCenter = [self clampedCenter:devOverlayButtonCenter];
    devOverlayWindow.frame = [self collapsedFrame];
    [devOverlayWindow layoutIfNeeded];
    [self applyButtonPosition];
}

+ (void)handleButtonPan:(UIPanGestureRecognizer *)gesture
{
    switch (gesture.state)
    {
        case UIGestureRecognizerStateBegan: {
            [self growOverlayWindow];
            [gesture setTranslation:CGPointZero inView:devOverlayWindow];
            devOverlayDragStartCenter = devOverlayButtonCenter;

            [[[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight]
                impactOccurred];
            break;
        }
        case UIGestureRecognizerStateChanged: {
            CGPoint translation = [gesture translationInView:devOverlayWindow];
            devOverlayButtonCenter =
                [self clampedCenter:CGPointMake(devOverlayDragStartCenter.x + translation.x,
                                                devOverlayDragStartCenter.y + translation.y)];
            [self applyButtonPosition];
            break;
        }
        case UIGestureRecognizerStateEnded:
        case UIGestureRecognizerStateCancelled:
        case UIGestureRecognizerStateFailed: {
            [self persistButtonCenter];
            [self shrinkOverlayWindow];
            break;
        }
        default:
            break;
    }
}

+ (void)performDeveloperMenuItem:(NSDictionary *)item editor:(NSDictionary *)editor
{
    NSString *followUp = item[@"followUp"];
    if ([followUp isEqualToString:@"reload-app"])
    {
        [Utilities reloadApp];
    }
    else if ([followUp isEqualToString:@"edit-settings"])
    {
        [self presentSettingsEditor:editor];
    }
    else if ([followUp isEqualToString:@"open-toolbox"])
    {
        [Toolbox showToolboxMenu];
    }
}

+ (void)showDeveloperMenu
{
    NSDictionary      *model = [CoreBridge toolboxObject:@"developer-menu" argument:@""];
    UIAlertController *menu =
        [UIAlertController alertControllerWithTitle:model[@"title"]
                                            message:nil
                                     preferredStyle:UIAlertControllerStyleAlert];

    for (NSDictionary *item in model[@"items"])
    {
        [menu addAction:[UIAlertAction actionWithTitle:item[@"title"]
                                                 style:UIAlertActionStyleDefault
                                               handler:^(__unused UIAlertAction *action) {
                                                   [self performDeveloperMenuItem:item
                                                                           editor:model[@"editor"]];
                                               }]];
    }
    [menu addAction:[UIAlertAction actionWithTitle:model[@"cancel"]
                                             style:UIAlertActionStyleCancel
                                           handler:nil]];

    UIViewController *presenter = discordKeyWindow.rootViewController;
    while (presenter.presentedViewController)
    {
        presenter = presenter.presentedViewController;
    }
    if (!presenter)
        return;

    [presenter presentViewController:menu animated:YES completion:nil];
}

+ (void)presentSettingsEditor:(NSDictionary *)model
{
    UIViewController *presenter = [Utilities topViewController];
    if (!presenter)
        return;

    DevOverlaySettingsEditorViewController *editor =
        [[DevOverlaySettingsEditorViewController alloc] init];
    editor.model                  = model;
    editor.modalPresentationStyle = UIModalPresentationOverFullScreen;
    editor.modalTransitionStyle   = UIModalTransitionStyleCrossDissolve;
    [presenter presentViewController:editor animated:YES completion:nil];
}

#pragma mark - Development build banner

+ (void)showDevelopmentBuildBanner
{
    static UILabel *devBuildLabel = nil;

    if (devBuildLabel)
    {
        return;
    }

    UIWindow *window = [Utilities keyWindow];
    if (!window)
    {
        return;
    }

    CGFloat screenWidth = window.bounds.size.width;
    CGFloat height      = 52.0;
    CGFloat yPosition   = window.safeAreaInsets.top;

    devBuildLabel = [[UILabel alloc] initWithFrame:CGRectMake(0, yPosition, screenWidth, height)];
    devBuildLabel.backgroundColor = [UIColor colorWithRed:0.0 green:0.0 blue:0.0 alpha:0.7];
    devBuildLabel.textColor       = [UIColor colorWithRed:1.0 green:0.2 blue:0.2 alpha:1.0];
    devBuildLabel.font            = [UIFont boldSystemFontOfSize:11.0];
    devBuildLabel.textAlignment   = NSTextAlignmentCenter;
    devBuildLabel.numberOfLines   = 3;
    devBuildLabel.lineBreakMode   = NSLineBreakByTruncatingTail;

    devBuildLabel.text = [CoreBridge developmentBuildBanner];

    devBuildLabel.layer.shadowColor   = [UIColor blackColor].CGColor;
    devBuildLabel.layer.shadowOffset  = CGSizeMake(0.0, 1.0);
    devBuildLabel.layer.shadowOpacity = 0.8;
    devBuildLabel.layer.shadowRadius  = 1.0;
    devBuildLabel.alpha               = 0.0;

    [window addSubview:devBuildLabel];
    [window bringSubviewToFront:devBuildLabel];

    [UIView animateWithDuration:0.4 animations:^{ devBuildLabel.alpha = 1.0; }];

    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW,
                      (int64_t) ([CoreBridge developmentBuildBannerDuration] * NSEC_PER_SEC)),
        dispatch_get_main_queue(), ^{
            if (!devBuildLabel || !devBuildLabel.superview)
            {
                return;
            }

            [UIView animateWithDuration:0.4
                animations:^{ devBuildLabel.alpha = 0.0; }
                completion:^(BOOL finished) {
                    [devBuildLabel removeFromSuperview];
                    devBuildLabel = nil;
                }];
        });
}

@end
