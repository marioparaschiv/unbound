#import <objc/message.h>

#include "LoaderDynamicIsland.h"
#import "Utilities+DynamicIsland.h"

namespace island = loader::dynamicisland;

static UIView              *islandOverlayView = nil;
static island::Presentation islandPresentation;

static CGRect rectOf(const island::Frame &frame)
{
    return CGRectMake(frame.x, frame.y, frame.width, frame.height);
}

static island::ViewState islandViewState(void)
{
    if (!islandOverlayView)
    {
        return {};
    }
    return {true, (bool) islandOverlayView.hidden, islandOverlayView.alpha};
}

static std::optional<island::Frame> systemCutout(void)
{
    UIScreen *screen         = UIScreen.mainScreen;
    SEL       cutoutSelector = NSSelectorFromString(@"_exclusionArea");
    if (![screen respondsToSelector:cutoutSelector])
    {
        return std::nullopt;
    }

    id  shape        = ((id (*)(id, SEL)) objc_msgSend)(screen, cutoutSelector);
    SEL rectSelector = NSSelectorFromString(@"rect");
    if (![shape respondsToSelector:rectSelector])
    {
        return std::nullopt;
    }

    CGRect rect = ((CGRect (*)(id, SEL)) objc_msgSend)(shape, rectSelector);
    return island::Frame{rect.origin.x, rect.origin.y, rect.size.width, rect.size.height};
}

static std::optional<island::Cutout> deviceCutout(void)
{
    if (UIDevice.currentDevice.userInterfaceIdiom != UIUserInterfaceIdiomPhone)
    {
        return std::nullopt;
    }
    return island::cutoutFromSystem(systemCutout());
}

static UIRectCorner roundedCorners(island::CutoutKind kind)
{
    return kind == island::CutoutKind::Notch ? UIRectCornerBottomLeft | UIRectCornerBottomRight
                                             : UIRectCornerAllCorners;
}

static void addRect(UIBezierPath *path, CGFloat x, CGFloat y, CGFloat width, CGFloat height)
{
    [path appendPath:[UIBezierPath bezierPathWithRect:CGRectMake(x, y, width, height)]];
}

@implementation Utilities (DynamicIsland)

+ (BOOL)deviceHasDynamicIsland
{
    std::optional<island::Cutout> cutout = deviceCutout();

    [Logger
         debug:LOG_CATEGORY_UTILITIES
        format:@"Screen cutout: %@", cutout ? NSStringFromCGRect(rectOf(cutout->frame)) : @"none"];

    return cutout.has_value();
}

+ (UIImage *)createLogoImage
{
    UIGraphicsBeginImageContextWithOptions(CGSizeMake(island::kLogoWidth, island::kLogoHeight), NO,
                                           0);
    CGContextTranslateCTM(UIGraphicsGetCurrentContext(), -island::kLogoMinX, -island::kLogoMinY);

    UIBezierPath *whitePath = [UIBezierPath bezierPath];
    addRect(whitePath, 39.6, 116.15, 10.03, 10.03);
    addRect(whitePath, 39.6, 127.22, 10.03, 10.03);
    addRect(whitePath, 39.6, 138.28, 10.03, 10.03);
    addRect(whitePath, 39.6, 149.35, 10.03, 10.03);
    addRect(whitePath, 39.6, 160.41, 10.03, 10.03);
    addRect(whitePath, 39.6, 171.48, 10.03, 10.03);
    addRect(whitePath, 50.66, 94.02, 10.03, 10.03);
    addRect(whitePath, 50.66, 105.09, 10.03, 10.03);
    addRect(whitePath, 50.66, 116.15, 10.03, 10.03);
    addRect(whitePath, 50.66, 127.22, 10.03, 10.03);
    addRect(whitePath, 50.66, 138.28, 10.03, 10.03);
    addRect(whitePath, 50.66, 149.35, 10.03, 10.03);
    addRect(whitePath, 50.66, 160.41, 10.03, 10.03);
    addRect(whitePath, 50.66, 171.48, 10.03, 10.03);
    addRect(whitePath, 61.73, 71.89, 10.03, 10.03);
    addRect(whitePath, 61.73, 82.96, 10.03, 10.03);
    addRect(whitePath, 61.73, 94.02, 10.03, 10.03);
    addRect(whitePath, 61.73, 105.09, 10.03, 10.03);
    addRect(whitePath, 61.73, 116.15, 10.03, 10.03);
    addRect(whitePath, 61.73, 127.22, 10.03, 10.03);
    addRect(whitePath, 61.73, 138.28, 10.03, 10.03);
    addRect(whitePath, 61.73, 149.35, 10.03, 10.03);
    addRect(whitePath, 61.73, 160.41, 10.03, 10.03);
    addRect(whitePath, 61.73, 171.48, 10.03, 10.03);
    addRect(whitePath, 61.73, 182.54, 10.03, 10.03);
    addRect(whitePath, 72.79, 71.89, 10.03, 10.03);
    addRect(whitePath, 72.79, 82.96, 10.03, 10.03);
    addRect(whitePath, 72.79, 94.02, 10.03, 10.03);
    addRect(whitePath, 72.79, 105.09, 10.03, 10.03);
    addRect(whitePath, 72.79, 116.15, 10.03, 10.03);
    addRect(whitePath, 72.79, 127.22, 10.03, 10.03);
    addRect(whitePath, 72.79, 138.28, 10.03, 10.03);
    addRect(whitePath, 72.79, 149.35, 10.03, 10.03);
    addRect(whitePath, 72.79, 160.41, 10.03, 10.03);
    addRect(whitePath, 72.79, 171.48, 10.03, 10.03);
    addRect(whitePath, 72.79, 182.54, 10.03, 10.03);
    addRect(whitePath, 83.86, 60.83, 10.03, 10.03);
    addRect(whitePath, 83.86, 71.89, 10.03, 10.03);
    addRect(whitePath, 83.86, 82.96, 10.03, 10.03);
    addRect(whitePath, 83.86, 94.02, 10.03, 10.03);
    addRect(whitePath, 83.86, 105.09, 10.03, 10.03);
    addRect(whitePath, 83.86, 149.35, 10.03, 10.03);
    addRect(whitePath, 83.86, 160.41, 10.03, 10.03);
    addRect(whitePath, 83.86, 182.54, 10.03, 10.03);
    addRect(whitePath, 94.92, 60.83, 10.03, 10.03);
    addRect(whitePath, 94.92, 71.89, 10.03, 10.03);
    addRect(whitePath, 94.92, 82.96, 10.03, 10.03);
    addRect(whitePath, 94.92, 94.02, 10.03, 10.03);
    addRect(whitePath, 94.92, 105.09, 10.03, 10.03);
    addRect(whitePath, 94.92, 149.35, 10.03, 10.03);
    addRect(whitePath, 94.92, 160.41, 10.03, 10.03);
    addRect(whitePath, 94.92, 171.48, 10.03, 10.03);
    addRect(whitePath, 105.99, 71.89, 10.03, 10.03);
    addRect(whitePath, 105.99, 82.96, 10.03, 10.03);
    addRect(whitePath, 105.99, 94.02, 10.03, 10.03);
    addRect(whitePath, 105.99, 105.09, 10.03, 10.03);
    addRect(whitePath, 105.99, 116.15, 10.03, 10.03);
    addRect(whitePath, 105.99, 149.35, 10.03, 10.03);
    addRect(whitePath, 105.99, 160.41, 10.03, 10.03);
    addRect(whitePath, 105.99, 171.48, 10.03, 10.03);
    addRect(whitePath, 117.05, 71.89, 10.03, 10.03);
    addRect(whitePath, 117.05, 82.96, 10.03, 10.03);
    addRect(whitePath, 117.05, 94.02, 10.03, 10.03);
    addRect(whitePath, 117.05, 105.09, 10.03, 10.03);
    addRect(whitePath, 117.05, 116.15, 10.03, 10.03);
    addRect(whitePath, 117.05, 127.22, 10.03, 10.03);
    addRect(whitePath, 117.05, 138.28, 10.03, 10.03);
    addRect(whitePath, 117.05, 149.35, 10.03, 10.03);
    addRect(whitePath, 117.05, 160.41, 10.03, 10.03);
    addRect(whitePath, 117.05, 171.48, 10.03, 10.03);
    addRect(whitePath, 128.12, 71.89, 10.03, 10.03);
    addRect(whitePath, 128.12, 82.96, 10.03, 10.03);
    addRect(whitePath, 128.12, 94.02, 10.03, 10.03);
    addRect(whitePath, 128.12, 105.09, 10.03, 10.03);
    addRect(whitePath, 128.12, 116.15, 10.03, 10.03);
    addRect(whitePath, 128.12, 127.22, 10.03, 10.03);
    addRect(whitePath, 128.12, 138.28, 10.03, 10.03);
    addRect(whitePath, 128.12, 149.35, 10.03, 10.03);
    addRect(whitePath, 128.12, 160.41, 10.03, 10.03);
    addRect(whitePath, 128.12, 171.48, 10.03, 10.03);
    addRect(whitePath, 139.18, 71.89, 10.03, 10.03);
    addRect(whitePath, 139.18, 82.96, 10.03, 10.03);
    addRect(whitePath, 139.18, 94.02, 10.03, 10.03);
    addRect(whitePath, 139.18, 105.09, 10.03, 10.03);
    addRect(whitePath, 139.18, 116.15, 10.03, 10.03);
    addRect(whitePath, 139.18, 149.35, 10.03, 10.03);
    addRect(whitePath, 139.18, 160.41, 10.03, 10.03);
    addRect(whitePath, 139.18, 171.48, 10.03, 10.03);
    addRect(whitePath, 150.24, 60.83, 10.03, 10.03);
    addRect(whitePath, 150.24, 71.89, 10.03, 10.03);
    addRect(whitePath, 150.24, 82.96, 10.03, 10.03);
    addRect(whitePath, 150.24, 94.02, 10.03, 10.03);
    addRect(whitePath, 150.24, 105.09, 10.03, 10.03);
    addRect(whitePath, 150.24, 149.35, 10.03, 10.03);
    addRect(whitePath, 150.24, 160.41, 10.03, 10.03);
    addRect(whitePath, 150.24, 171.48, 10.03, 10.03);
    addRect(whitePath, 161.31, 60.83, 10.03, 10.03);
    addRect(whitePath, 161.31, 71.89, 10.03, 10.03);
    addRect(whitePath, 161.31, 82.96, 10.03, 10.03);
    addRect(whitePath, 161.31, 94.02, 10.03, 10.03);
    addRect(whitePath, 161.31, 105.09, 10.03, 10.03);
    addRect(whitePath, 161.31, 149.35, 10.03, 10.03);
    addRect(whitePath, 161.31, 160.41, 10.03, 10.03);
    addRect(whitePath, 161.31, 182.54, 10.03, 10.03);
    addRect(whitePath, 172.37, 71.89, 10.03, 10.03);
    addRect(whitePath, 172.37, 82.96, 10.03, 10.03);
    addRect(whitePath, 172.37, 94.02, 10.03, 10.03);
    addRect(whitePath, 172.37, 105.09, 10.03, 10.03);
    addRect(whitePath, 172.37, 116.15, 10.03, 10.03);
    addRect(whitePath, 172.37, 127.22, 10.03, 10.03);
    addRect(whitePath, 172.37, 138.28, 10.03, 10.03);
    addRect(whitePath, 172.37, 149.35, 10.03, 10.03);
    addRect(whitePath, 172.37, 160.41, 10.03, 10.03);
    addRect(whitePath, 172.37, 171.48, 10.03, 10.03);
    addRect(whitePath, 172.37, 182.54, 10.03, 10.03);
    addRect(whitePath, 183.44, 82.96, 10.03, 10.03);
    addRect(whitePath, 183.44, 94.02, 10.03, 10.03);
    addRect(whitePath, 183.44, 105.09, 10.03, 10.03);
    addRect(whitePath, 183.44, 116.15, 10.03, 10.03);
    addRect(whitePath, 183.44, 127.22, 10.03, 10.03);
    addRect(whitePath, 183.44, 138.28, 10.03, 10.03);
    addRect(whitePath, 183.44, 149.35, 10.03, 10.03);
    addRect(whitePath, 183.44, 160.41, 10.03, 10.03);
    addRect(whitePath, 183.44, 171.48, 10.03, 10.03);
    addRect(whitePath, 183.44, 182.54, 10.03, 10.03);
    addRect(whitePath, 194.5, 105.09, 10.03, 10.03);
    addRect(whitePath, 194.5, 116.15, 10.03, 10.03);
    addRect(whitePath, 194.5, 127.22, 10.03, 10.03);
    addRect(whitePath, 194.5, 138.28, 10.03, 10.03);
    addRect(whitePath, 194.5, 149.35, 10.03, 10.03);
    addRect(whitePath, 194.5, 160.41, 10.03, 10.03);
    addRect(whitePath, 194.5, 171.48, 10.03, 10.03);
    addRect(whitePath, 205.57, 116.15, 10.03, 10.03);
    addRect(whitePath, 205.57, 127.22, 10.03, 10.03);
    addRect(whitePath, 205.57, 138.28, 10.03, 10.03);
    addRect(whitePath, 205.57, 149.35, 10.03, 10.03);
    addRect(whitePath, 205.57, 160.41, 10.03, 10.03);
    addRect(whitePath, 205.57, 171.48, 10.03, 10.03);
    addRect(whitePath, 192.82, 64.84, 8.73, 8.73);
    addRect(whitePath, 209.66, 82.63, 7.93, 7.93);

    UIBezierPath *redPath = [UIBezierPath bezierPath];
    addRect(redPath, 37, 116.15, 2.6, 10.03);
    addRect(redPath, 37, 127.22, 2.6, 10.03);
    addRect(redPath, 37, 138.28, 2.6, 10.03);
    addRect(redPath, 37, 149.35, 2.6, 10.03);
    addRect(redPath, 37, 160.41, 2.6, 10.03);
    addRect(redPath, 37, 171.48, 2.6, 10.03);
    addRect(redPath, 48.06, 94.02, 2.6, 10.03);
    addRect(redPath, 48.06, 105.09, 2.6, 10.03);
    addRect(redPath, 59.13, 71.89, 2.6, 10.03);
    addRect(redPath, 59.13, 82.96, 2.6, 10.03);
    addRect(redPath, 59.13, 182.54, 2.6, 10.03);
    addRect(redPath, 81.26, 60.83, 2.6, 10.03);
    addRect(redPath, 92.32, 171.48, 2.6, 10.03);
    addRect(redPath, 103.39, 116.15, 2.6, 10.03);
    addRect(redPath, 114.45, 127.22, 2.6, 10.03);
    addRect(redPath, 114.45, 138.28, 2.6, 10.03);
    addRect(redPath, 147.64, 60.83, 2.6, 10.03);
    addRect(redPath, 158.71, 182.54, 2.6, 10.03);
    addRect(redPath, 169.77, 116.15, 2.6, 10.03);
    addRect(redPath, 169.77, 127.22, 2.6, 10.03);
    addRect(redPath, 169.77, 138.28, 2.6, 10.03);
    addRect(redPath, 169.77, 171.48, 2.6, 10.03);
    addRect(redPath, 190.22, 64.84, 2.6, 8.73);
    addRect(redPath, 207.06, 82.63, 2.6, 7.93);

    UIBezierPath *cyanPath = [UIBezierPath bezierPath];
    addRect(cyanPath, 82.82, 116.15, 2.6, 10.03);
    addRect(cyanPath, 82.82, 127.22, 2.6, 10.03);
    addRect(cyanPath, 82.82, 138.28, 2.6, 10.03);
    addRect(cyanPath, 82.82, 171.48, 2.6, 10.03);
    addRect(cyanPath, 93.89, 182.54, 2.6, 10.03);
    addRect(cyanPath, 104.95, 60.83, 2.6, 10.03);
    addRect(cyanPath, 138.15, 127.22, 2.6, 10.03);
    addRect(cyanPath, 138.15, 138.28, 2.6, 10.03);
    addRect(cyanPath, 149.21, 116.15, 2.6, 10.03);
    addRect(cyanPath, 160.27, 171.48, 2.6, 10.03);
    addRect(cyanPath, 171.34, 60.83, 2.6, 10.03);
    addRect(cyanPath, 182.4, 71.89, 2.6, 10.03);
    addRect(cyanPath, 193.47, 82.96, 2.6, 10.03);
    addRect(cyanPath, 193.47, 94.02, 2.6, 10.03);
    addRect(cyanPath, 193.47, 182.54, 2.6, 10.03);
    addRect(cyanPath, 204.53, 105.09, 2.6, 10.03);
    addRect(cyanPath, 215.6, 116.15, 2.6, 10.03);
    addRect(cyanPath, 215.6, 127.22, 2.6, 10.03);
    addRect(cyanPath, 215.6, 138.28, 2.6, 10.03);
    addRect(cyanPath, 215.6, 149.35, 2.6, 10.03);
    addRect(cyanPath, 215.6, 160.41, 2.6, 10.03);
    addRect(cyanPath, 215.6, 171.48, 2.6, 10.03);
    addRect(cyanPath, 201.55, 64.84, 2.6, 8.73);
    addRect(cyanPath, 217.59, 82.63, 2.6, 7.93);

    UIBezierPath *shadowPath = [whitePath copy];
    [shadowPath applyTransform:CGAffineTransformMakeTranslation(6, 6)];
    [[UIColor colorWithWhite:0 alpha:0.5] setFill];
    [shadowPath fill];

    [[UIColor colorWithRed:1.0 green:46 / 255.0 blue:99 / 255.0 alpha:1] setFill];
    [redPath fill];

    [[UIColor colorWithRed:33 / 255.0 green:230 / 255.0 blue:1.0 alpha:1] setFill];
    [cyanPath fill];

    [[UIColor whiteColor] setFill];
    [whitePath fill];

    [whitePath addClip];
    [[UIColor colorWithWhite:0 alpha:0.22] setFill];
    for (CGFloat y = 60; y < 194; y += 4)
    {
        UIRectFillUsingBlendMode(CGRectMake(island::kLogoMinX, y, island::kLogoWidth, 1.6),
                                 kCGBlendModeNormal);
    }

    UIImage *result = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();

    return result;
}

+ (void)showDynamicIslandOverlay
{
    island::Plan plan = islandPresentation.show(islandViewState());
    if (plan.create)
    {
        [self createDynamicIslandOverlayView];
    }
    if (!plan.reveal)
    {
        return;
    }

    islandOverlayView.hidden = NO;

    [UIView animateWithDuration:island::kRevealSeconds
                     animations:^{ islandOverlayView.alpha = 1.0; }];

    [Logger debug:LOG_CATEGORY_UTILITIES format:@"Showing Dynamic Island overlay"];
}

+ (void)hideDynamicIslandOverlay
{
    if (!islandPresentation.hide(islandViewState()).conceal)
    {
        return;
    }

    islandOverlayView.hidden = YES;
    islandOverlayView.alpha  = 0.0;

    [islandOverlayView.superview setNeedsLayout];
    [islandOverlayView.superview layoutIfNeeded];

    [Logger debug:LOG_CATEGORY_UTILITIES format:@"Hiding Dynamic Island overlay"];
}

+ (void)createDynamicIslandOverlayView
{
    if (islandOverlayView)
    {
        [Logger debug:LOG_CATEGORY_UTILITIES
               format:@"Island overlay view already exists, skipping creation"];
        return;
    }

    UIWindow *keyWindow = [self keyWindow];
    if (!keyWindow)
    {
        [Logger error:LOG_CATEGORY_UTILITIES
               format:@"Failed to find key window for Dynamic Island overlay"];
        return;
    }

    std::optional<island::Cutout> cutout = deviceCutout();
    if (!cutout)
    {
        [Logger error:LOG_CATEGORY_UTILITIES format:@"No screen cutout to cover"];
        return;
    }
    island::Frame frame = cutout->frame;
    if (!CGRectContainsRect(keyWindow.bounds, rectOf(frame)))
    {
        [Logger info:LOG_CATEGORY_UTILITIES
              format:@"Screen cutout %@ is outside Discord's window %@, skipping overlay",
                     NSStringFromCGRect(rectOf(frame)), NSStringFromCGRect(keyWindow.bounds)];
        return;
    }

    [Logger debug:LOG_CATEGORY_UTILITIES
           format:@"Creating Dynamic Island overlay view at x:%f y:%f width:%f height:%f", frame.x,
                  frame.y, frame.width, frame.height];

    islandOverlayView                 = [[UIView alloc] initWithFrame:rectOf(frame)];
    islandOverlayView.backgroundColor = [UIColor blackColor];
    islandOverlayView.alpha           = 0.0;
    islandOverlayView.hidden          = YES;

    islandOverlayView.userInteractionEnabled = NO;

    UIBezierPath *path =
        [UIBezierPath bezierPathWithRoundedRect:islandOverlayView.bounds
                              byRoundingCorners:roundedCorners(cutout->kind)
                                    cornerRadii:CGSizeMake(island::cornerRadius(*cutout),
                                                           island::cornerRadius(*cutout))];

    CAShapeLayer *maskLayer      = [CAShapeLayer layer];
    maskLayer.path               = path.CGPath;
    islandOverlayView.layer.mask = maskLayer;

    UIImage *logoImage = [self createLogoImage];
    [Logger debug:LOG_CATEGORY_UTILITIES format:@"Created logo image for Dynamic Island overlay"];

    UIImageView *logoView = [[UIImageView alloc] init];
    logoView.image        = logoImage;
    logoView.contentMode  = UIViewContentModeScaleAspectFit;

    logoView.frame = rectOf(island::logoFrame(*cutout));

    [islandOverlayView addSubview:logoView];

    [keyWindow addSubview:islandOverlayView];
    [keyWindow bringSubviewToFront:islandOverlayView];
    [Logger info:LOG_CATEGORY_UTILITIES
          format:@"Successfully added Dynamic Island overlay to key window"];
}

+ (void)initializeDynamicIslandOverlay
{
    [Logger info:LOG_CATEGORY_UTILITIES format:@"Checking for a screen cutout..."];

    switch (islandPresentation.start([self deviceHasDynamicIsland]))
    {
        case island::Start::NoIsland:
            [Logger info:LOG_CATEGORY_UTILITIES
                  format:@"Device has no Dynamic Island or notch, skipping overlay"];
            return;
        case island::Start::AlreadyStarted:
            [Logger info:LOG_CATEGORY_UTILITIES
                  format:@"Dynamic Island overlay already initialized"];
            return;
        case island::Start::Started:
            break;
    }

    [Logger info:LOG_CATEGORY_UTILITIES format:@"Setting up Dynamic Island overlay notifications"];

    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];

    [center addObserverForName:UIApplicationDidBecomeActiveNotification
                        object:nil
                         queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *note) {
                        [Logger debug:LOG_CATEGORY_UTILITIES
                               format:@"App did become active, showing overlay"];
                        dispatch_async(dispatch_get_main_queue(),
                                       ^{ [self showDynamicIslandOverlay]; });
                    }];

    [center addObserverForName:UIApplicationWillResignActiveNotification
                        object:nil
                         queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *note) {
                        [Logger debug:LOG_CATEGORY_UTILITIES
                               format:@"App will resign active, hiding overlay"];
                        dispatch_async(dispatch_get_main_queue(),
                                       ^{ [self hideDynamicIslandOverlay]; });
                    }];

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, island::kCreateDelaySeconds * NSEC_PER_SEC),
                   dispatch_get_main_queue(), ^{
                       [Logger info:LOG_CATEGORY_UTILITIES
                             format:@"Creating Dynamic Island overlay..."];
                       [self createDynamicIslandOverlayView];

                       dispatch_after(dispatch_time(DISPATCH_TIME_NOW,
                                                    island::kShowDelaySeconds * NSEC_PER_SEC),
                                      dispatch_get_main_queue(),
                                      ^{ [self showDynamicIslandOverlay]; });
                   });
}

@end
