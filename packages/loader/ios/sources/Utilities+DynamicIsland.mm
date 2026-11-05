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
    return kind == island::CutoutKind::Island ? UIRectCornerAllCorners
                                              : UIRectCornerBottomLeft | UIRectCornerBottomRight;
}

static UIColor *inkColor(island::Ink ink)
{
    switch (ink)
    {
        case island::Ink::Shadow:
            return [UIColor colorWithWhite:0 alpha:0.5];
        case island::Ink::Red:
            return [UIColor colorWithRed:1.0 green:46 / 255.0 blue:99 / 255.0 alpha:1];
        case island::Ink::Cyan:
            return [UIColor colorWithRed:33 / 255.0 green:230 / 255.0 blue:1.0 alpha:1];
        case island::Ink::White:
            return UIColor.whiteColor;
        case island::Ink::Scanline:
            return [UIColor colorWithWhite:0 alpha:0.22];
    }
    return UIColor.clearColor;
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
    CGSize                         size   = CGSizeMake(island::kLogoWidth, island::kLogoHeight);
    UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat preferredFormat];
    format.opaque                         = NO;

    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:size
                                                                               format:format];

    return [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
        for (const island::Pixel &pixel : island::logoPixels())
        {
            [inkColor(pixel.ink) setFill];
            UIRectFillUsingBlendMode(CGRectMake(pixel.frame.x - island::kLogoMinX,
                                                pixel.frame.y - island::kLogoMinY,
                                                pixel.frame.width, pixel.frame.height),
                                     kCGBlendModeNormal);
        }
    }];
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

    logoView.frame = rectOf(island::logoFrame(frame));

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
