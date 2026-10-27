#import "ChatUI.h"

#import "CoreBridge.h"
#import "CoreConversions.h"
#include "LoaderChatUI.h"

#pragma clang diagnostic ignored "-Wvla-cxx-extension"

using unbound::ios::toStdString;

@implementation ChatUI

static std::optional<double> customAvatarRadius    = std::nullopt;
static BOOL                  messageBubblesEnabled = NO;

static BOOL isViewOfClass(UIView *view, const char *className)
{
    return [NSStringFromClass([view class]) isEqualToString:@(className)];
}

static loader::chatui::Rect coreRect(CGRect rect)
{
    return {rect.origin.x, rect.origin.y, rect.size.width, rect.size.height};
}

static CGRect cgRect(const loader::chatui::Rect &rect)
{
    return CGRectMake(rect.x, rect.y, rect.width, rect.height);
}

static void applyAvatarRadius(UIView *view)
{
    view.layer.cornerRadius =
        loader::chatui::avatarCornerRadius(customAvatarRadius, view.bounds.size.width);
}

static UIColor *messageCellDynamicColor = nil;

+ (void)reloadPreferences
{
    messageBubblesEnabled = [CoreBridge preferenceEnabled:@"message-bubbles"];
    NSString *radius      = [CoreBridge preference:@"avatar-radius" argument:@""];
    customAvatarRadius =
        radius.length > 0 ? std::optional<double>([radius doubleValue]) : std::nullopt;

    [self updateMessageBubbleSettings];
    [self updateAllAvatarViews];
}

+ (void)updateAllAvatarViews
{
    dispatch_async(dispatch_get_main_queue(), ^{
        UIWindow *keyWindow = [Utilities keyWindow];

        if (keyWindow)
        {
            [self updateAvatarViewsInView:keyWindow];
        }
    });
}

+ (void)updateAvatarViewsInView:(UIView *)view
{
    if (isViewOfClass(view, loader::chatui::kAvatarViewClass))
    {
        applyAvatarRadius(view);
        [Logger debug:LOG_CATEGORY_CHATUI
               format:@"Updated avatar view with radius: %f", view.layer.cornerRadius];
    }

    for (UIView *subview in view.subviews)
    {
        [self updateAvatarViewsInView:subview];
    }
}

+ (void)updateMessageBubbleSettings
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [self loadDynamicColors];
        [self updateAllMessageCells];
    });
}

+ (BOOL)isDiscordDarkMode
{
    Class themeColorClass = NSClassFromString(@"DCDThemeColor");
    if (themeColorClass && [themeColorClass respondsToSelector:@selector(BACKGROUND_PRIMARY)])
    {
        return [CoreBridge isDarkColor:[themeColorClass BACKGROUND_PRIMARY]];
    }
    return YES;
}

+ (void)loadDynamicColors
{
    UIColor *darkColor  = [CoreBridge messageBubbleColorForDarkTheme:YES];
    UIColor *lightColor = [CoreBridge messageBubbleColorForDarkTheme:NO];

    messageCellDynamicColor =
        [[UIColor alloc] initWithDynamicProvider:^UIColor *(UITraitCollection *traitCollection) {
            return [self isDiscordDarkMode] ? darkColor : lightColor;
        }];
}

+ (void)updateAllMessageCells
{
    UIWindow *keyWindow = [Utilities keyWindow];

    if (keyWindow)
    {
        [self updateMessageCellsInView:keyWindow];
    }
}

+ (void)updateMessageCellsInView:(UIView *)view
{
    if (isViewOfClass(view, loader::chatui::kMessageCellClass))
    {
        [self updateMessageCell:(DCDMessageTableViewCell *) view];
    }

    for (UIView *subview in view.subviews)
    {
        [self updateMessageCellsInView:subview];
    }
}

+ (UIView *)findLargestAvatarView:(UIView *)view
{
    UIView *best     = nil;
    CGFloat bestArea = 0;

    if (isViewOfClass(view, loader::chatui::kAvatarViewClass))
    {
        best     = view;
        bestArea = view.bounds.size.width * view.bounds.size.height;
    }

    for (UIView *subview in view.subviews)
    {
        UIView *candidate = [self findLargestAvatarView:subview];
        if (candidate)
        {
            CGFloat area = candidate.bounds.size.width * candidate.bounds.size.height;
            if (area > bestArea)
            {
                best     = candidate;
                bestArea = area;
            }
        }
    }

    return best;
}

+ (BOOL)isMediaView:(UIView *)view
{
    BOOL isMedia = loader::chatui::isMediaViewClass(toStdString(NSStringFromClass([view class])));
    return isMedia && !view.hidden && view.bounds.size.width > 0 && view.bounds.size.height > 0;
}

+ (BOOL)hasMessageContent:(UIView *)view
{
    if (view.hidden || CGRectIsEmpty(view.bounds))
        return NO;

    if ([self isMediaView:view])
        return YES;

    if (isViewOfClass(view, loader::chatui::kAttributedTextViewClass))
    {
        NSAttributedString *attrText = [view valueForKey:@"attributedText"];
        return attrText.length > 0;
    }

    for (UIView *subview in view.subviews)
    {
        if ([self hasMessageContent:subview])
            return YES;
    }

    return NO;
}

+ (UIView *)messageBodyIn:(UIView *)contentColumn
{
    for (UIView *child in contentColumn.subviews.reverseObjectEnumerator)
    {
        if ([self hasMessageContent:child])
            return child;
    }

    return nil;
}

+ (void)collectMediaViewsIn:(UIView *)view into:(NSMutableArray<UIView *> *)mediaViews
{
    if ([self isMediaView:view])
    {
        [mediaViews addObject:view];
        return;
    }

    for (UIView *subview in view.subviews)
        [self collectMediaViewsIn:subview into:mediaViews];
}

+ (UIView *)findTextViewIn:(UIView *)view
{
    if ([view respondsToSelector:@selector(attributedText)])
    {
        NSAttributedString *attrText = [view valueForKey:@"attributedText"];
        if (attrText.length > 0)
            return view;
    }

    for (UIView *subview in view.subviews)
    {
        UIView *found = [self findTextViewIn:subview];
        if (found)
            return found;
    }

    return nil;
}

+ (CGFloat)textWidthIn:(UIView *)contentBody limit:(CGFloat)limit
{
    UIView *textView = [self findTextViewIn:contentBody];
    if (!textView)
        return 0;

    NSAttributedString *attrText = [textView valueForKey:@"attributedText"];
    CGRect measured  = [attrText boundingRectWithSize:CGSizeMake(limit, CGFLOAT_MAX)
                                              options:NSStringDrawingUsesLineFragmentOrigin
                                              context:nil];
    CGRect textFrame = [textView convertRect:textView.bounds toView:contentBody];
    return textFrame.origin.x + ceil(measured.size.width);
}

+ (CGFloat)contentWidthIn:(UIView *)contentBody limit:(CGFloat)limit
{
    CGFloat contentWidth = [self textWidthIn:contentBody limit:limit];

    NSMutableArray<UIView *> *mediaViews = [NSMutableArray array];
    [self collectMediaViewsIn:contentBody into:mediaViews];
    for (UIView *mediaView in mediaViews)
    {
        CGRect mediaFrame = [mediaView convertRect:mediaView.bounds toView:contentBody];
        contentWidth      = MAX(contentWidth, CGRectGetMaxX(mediaFrame));
    }

    return contentWidth;
}

+ (CGRect)contentBubbleFrameForCell:(DCDMessageTableViewCell *)cell
{
    UIView *avatarView = [self findLargestAvatarView:cell.contentView];
    if (!avatarView)
        return CGRectNull;

    UIView *node          = avatarView;
    UIView *contentColumn = nil;
    for (int level = 0; level < loader::chatui::kContentColumnSearchDepth && node.superview;
         level++)
    {
        UIView *parent = node.superview;
        for (UIView *sibling in parent.subviews)
        {
            if (sibling != node &&
                loader::chatui::isContentColumn(sibling.frame.size.width, node.frame.size.width))
            {
                contentColumn = sibling;
                break;
            }
        }
        if (contentColumn)
            break;
        node = parent;
    }
    if (!contentColumn)
        return CGRectNull;

    UIView *contentBody = [self messageBodyIn:contentColumn];
    if (!contentBody)
        return CGRectNull;

    CGRect  frame        = [contentBody convertRect:contentBody.bounds toView:cell];
    CGFloat contentWidth = [self contentWidthIn:contentBody limit:frame.size.width];
    CGSize  padding      = [CoreBridge messageBubblePadding];
    return cgRect(loader::chatui::bubbleFrame(coreRect(frame), contentWidth,
                                              {padding.width, padding.height}));
}

+ (void)updateMessageCell:(DCDMessageTableViewCell *)cell
{
    BOOL enabled = messageBubblesEnabled;

    if (!enabled)
    {
        if (cell.customBackgroundView)
        {
            cell.customBackgroundView.hidden = YES;
        }
        return;
    }

    if (!cell.customBackgroundView)
    {
        cell.customBackgroundView                     = [[UIView alloc] init];
        cell.customBackgroundView.layer.masksToBounds = YES;
        cell.backgroundView                           = cell.customBackgroundView;
    }
    else if (cell.backgroundView != cell.customBackgroundView)
    {
        cell.backgroundView = cell.customBackgroundView;
    }

    cell.customBackgroundView.hidden          = NO;
    cell.customBackgroundView.backgroundColor = messageCellDynamicColor;

    cell.customBackgroundView.layer.cornerRadius = [CoreBridge messageBubbleRadius];
}

+ (void)updateMessageCellFrame:(DCDMessageTableViewCell *)cell
{
    [self updateMessageCellFrame:cell retriesRemaining:loader::chatui::kBubbleFrameRetries];
}

+ (void)updateMessageCellFrame:(DCDMessageTableViewCell *)cell
              retriesRemaining:(int)retriesRemaining
{
    if (!cell.customBackgroundView || cell.customBackgroundView.hidden)
        return;

    CGRect frame = [self contentBubbleFrameForCell:cell];
    if (CGRectIsNull(frame) || CGRectIsEmpty(frame))
    {
        if (retriesRemaining > 0)
        {
            __weak DCDMessageTableViewCell *weakCell = cell;
            dispatch_async(dispatch_get_main_queue(), ^{
                DCDMessageTableViewCell *strongCell = weakCell;
                if (strongCell)
                {
                    [self updateMessageCellFrame:strongCell retriesRemaining:retriesRemaining - 1];
                }
            });
        }
        return;
    }

    cell.customBackgroundView.frame = frame;
}

@end

%hook DCDAvatarView

- (void)layoutSubviews
{
    %orig;
    applyAvatarRadius(self);
}

%end

%hook DCDMessageTableViewCell
%property(nonatomic, strong) UIView *customBackgroundView;

- (void)setBackgroundColor:(UIColor *)arg1
{
    BOOL enabled = messageBubblesEnabled;
    %orig(enabled ? [UIColor clearColor] : arg1);
}

- (void)didMoveToSuperview
{
    %orig;

    BOOL enabled = messageBubblesEnabled;

    if (enabled)
    {
        [ChatUI updateMessageCell:self];
    }
    else if (self.customBackgroundView)
    {
        if (self.backgroundView == self.customBackgroundView)
        {
            self.backgroundView = nil;
        }
        self.customBackgroundView = nil;
    }
}

- (void)prepareForReuse
{
    %orig;
    dispatch_async(dispatch_get_main_queue(), ^{ [ChatUI updateMessageCell:self]; });
}

- (void)layoutSubviews
{
    %orig;

    BOOL enabled = messageBubblesEnabled;
    if (enabled)
    {
        [ChatUI updateMessageCellFrame:self];
    }
}

%end

%hook DCDSeparatorTableViewCell

- (void)setBackgroundColor:(UIColor *)arg1
{
    BOOL enabled = messageBubblesEnabled;
    %orig(enabled ? [UIColor clearColor] : arg1);
}

%end

%ctor
{
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW,
                      (int64_t) (loader::chatui::kPreferencesDelaySeconds * NSEC_PER_SEC)),
        dispatch_get_main_queue(), ^{ [ChatUI reloadPreferences]; });
}
