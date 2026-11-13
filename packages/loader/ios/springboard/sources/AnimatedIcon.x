#import <UIKit/UIKit.h>
#import <notify.h>

static NSString *const kDiscordBundleId    = @"com.hammerandchisel.discord";
static NSString *const kAnimatedInfoKey    = @"UnboundAnimatedIcon";
static const char     *kChangedNotification = "app.unbound.animated-icon.changed";
static const NSInteger kOverlayTag          = 0x0b1c0;
static const CGFloat   kCornerRatio         = 0.2237;

@interface LSApplicationProxy : NSObject
+ (instancetype)applicationProxyForIdentifier:(NSString *)identifier;
@property (readonly, nonatomic) NSString *alternateIconName;
@property (readonly, nonatomic) NSURL    *bundleURL;
@end

@interface SBIconView : UIView
- (id)icon;
@end

static NSHashTable<UIView *> *gDiscordIconViews;
static UIImage               *gAnimation;
static NSString              *gAnimationBundle;
static BOOL                   gActive;
static BOOL                   gResolved;

static NSInteger greatestDivisor(NSInteger first, NSInteger second)
{
    while (second)
    {
        NSInteger rest = first % second;
        first          = second;
        second         = rest;
    }
    return first;
}

static UIImage *loadAnimation(NSString *bundlePath, NSDictionary *animated)
{
    NSArray<NSString *> *frames    = animated[@"Frames"];
    NSArray<NSNumber *> *durations = animated[@"Durations"];
    if (![frames isKindOfClass:NSArray.class] || ![durations isKindOfClass:NSArray.class] || frames.count == 0 ||
        frames.count != durations.count)
    {
        return nil;
    }
    NSInteger unit = 0;
    for (NSNumber *duration in durations)
    {
        unit = greatestDivisor(unit, duration.integerValue);
    }
    if (unit <= 0)
    {
        return nil;
    }
    NSString       *suffix = UIScreen.mainScreen.scale >= 3 ? @"60x60@3x.png" : @"60x60@2x.png";
    NSMutableArray *images = [NSMutableArray array];
    double          total  = 0;
    for (NSUInteger index = 0; index < frames.count; index++)
    {
        NSString *path  = [bundlePath stringByAppendingPathComponent:[frames[index] stringByAppendingString:suffix]];
        UIImage  *image = [UIImage imageWithContentsOfFile:path];
        if (!image)
        {
            return nil;
        }
        NSInteger duration = durations[index].integerValue;
        for (NSInteger repeat = 0; repeat < duration / unit; repeat++)
        {
            [images addObject:image];
        }
        total += duration / 1000.0;
    }
    return [UIImage animatedImageWithImages:images duration:total];
}

static void resolveState(void)
{
    LSApplicationProxy *proxy      = [NSClassFromString(@"LSApplicationProxy") applicationProxyForIdentifier:kDiscordBundleId];
    NSString           *bundlePath = proxy.bundleURL.path;
    NSDictionary       *info =
        bundlePath ? [NSDictionary dictionaryWithContentsOfFile:[bundlePath stringByAppendingPathComponent:@"Info.plist"]]
                   : nil;
    NSDictionary *animated = info[kAnimatedInfoKey];
    NSArray      *frames   = [animated isKindOfClass:NSDictionary.class] ? animated[@"Frames"] : nil;
    NSString     *current  = proxy.alternateIconName;
    gResolved              = YES;
    gActive = [frames isKindOfClass:NSArray.class] && current && [frames containsObject:current];
    if (gActive && ![gAnimationBundle isEqualToString:bundlePath])
    {
        gAnimation       = loadAnimation(bundlePath, animated);
        gAnimationBundle = bundlePath;
    }
    gActive = gActive && gAnimation;
}

static BOOL isDiscordIconView(UIView *view)
{
    id icon = [(SBIconView *) view icon];
    return [icon respondsToSelector:@selector(applicationBundleID)] &&
           [[icon performSelector:@selector(applicationBundleID)] isEqual:kDiscordBundleId];
}

static UIView *iconImageViewIn(UIView *view, NSInteger depth)
{
    for (UIView *subview in view.subviews)
    {
        if (subview.tag != kOverlayTag && [NSStringFromClass(subview.class) containsString:@"IconImageView"])
        {
            return subview;
        }
    }
    if (depth <= 0)
    {
        return nil;
    }
    for (UIView *subview in view.subviews)
    {
        UIView *found = iconImageViewIn(subview, depth - 1);
        if (found)
        {
            return found;
        }
    }
    return nil;
}

static void removeOverlay(UIView *iconView)
{
    [[iconView viewWithTag:kOverlayTag] removeFromSuperview];
    [gDiscordIconViews removeObject:iconView];
}

static void applyOverlay(UIView *iconView)
{
    UIImageView *overlay = (UIImageView *) [iconView viewWithTag:kOverlayTag];
    UIView      *image   = iconImageViewIn(iconView, 2);
    if (!gActive || !image)
    {
        [overlay removeFromSuperview];
        return;
    }
    if (!overlay)
    {
        overlay                        = [[UIImageView alloc] init];
        overlay.tag                    = kOverlayTag;
        overlay.userInteractionEnabled = NO;
        overlay.clipsToBounds          = YES;
        overlay.layer.cornerCurve      = kCACornerCurveContinuous;
    }
    if (overlay.superview != image.superview)
    {
        [image.superview insertSubview:overlay aboveSubview:image];
    }
    overlay.frame              = image.frame;
    overlay.layer.cornerRadius = image.bounds.size.width * kCornerRatio;
    if (overlay.image != gAnimation)
    {
        overlay.image = gAnimation;
    }
    if (!overlay.isAnimating)
    {
        [overlay startAnimating];
    }
}

%hook SBIconView

- (void)layoutSubviews
{
    %orig;
    if (!isDiscordIconView(self))
    {
        removeOverlay(self);
        return;
    }
    if (!gResolved)
    {
        resolveState();
    }
    [gDiscordIconViews addObject:self];
    applyOverlay(self);
}

%end

%ctor
{
    gDiscordIconViews = [NSHashTable weakObjectsHashTable];
    int token;
    notify_register_dispatch(kChangedNotification, &token, dispatch_get_main_queue(), ^(int changed) {
        resolveState();
        for (UIView *view in gDiscordIconViews.allObjects)
        {
            if (isDiscordIconView(view))
            {
                applyOverlay(view);
            }
            else
            {
                removeOverlay(view);
            }
        }
    });
    %init;
}
