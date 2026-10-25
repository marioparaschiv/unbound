#import "ChatUI.h"
#import "CoreBridge.h"

@implementation ChatUI

static NSNumber *customAvatarRadius    = nil;
static BOOL      messageBubblesEnabled = NO;

static CGFloat messageBubbleRadius            = 10;
static CGFloat messageBubbleHorizontalPadding = 8;
static CGFloat messageBubbleVerticalPadding   = 4;

static UIColor *messageCellLightColor   = nil;
static UIColor *messageCellDarkColor    = nil;
static UIColor *messageCellDynamicColor = nil;

+ (void)reloadPreferences
{
    messageBubblesEnabled = [CoreBridge preferenceEnabled:@"message-bubbles"];
    NSString *radius      = [CoreBridge preference:@"avatar-radius" argument:@""];
    customAvatarRadius    = radius.length > 0 ? @([radius doubleValue]) : nil;

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
    if ([NSStringFromClass([view class]) isEqualToString:@"DCDAvatarView"])
    {
        if (customAvatarRadius)
        {
            view.layer.cornerRadius = [customAvatarRadius floatValue];
        }
        else
        {
            view.layer.cornerRadius = view.bounds.size.width / 2.0;
        }
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
    CGFloat red             = 0;
    Class   themeColorClass = NSClassFromString(@"DCDThemeColor");
    if (themeColorClass && [themeColorClass respondsToSelector:@selector(BACKGROUND_PRIMARY)])
    {
        UIColor *bgColor = [themeColorClass BACKGROUND_PRIMARY];
        [bgColor getRed:&red green:nil blue:nil alpha:nil];
        return red < 0.25;
    }
    return YES;
}

+ (void)loadDynamicColors
{
    NSData       *data  = [[CoreBridge preference:@"bubble-style" argument:@""] dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *style = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
    if ([style isKindOfClass:[NSDictionary class]])
    {
        messageBubbleRadius            = [style[@"radius"] doubleValue];
        messageBubbleHorizontalPadding = [style[@"horizontalPadding"] doubleValue];
        messageBubbleVerticalPadding   = [style[@"verticalPadding"] doubleValue];
        messageCellDarkColor           = [CoreBridge colorFromString:style[@"darkColor"] ?: @""];
        messageCellLightColor          = [CoreBridge colorFromString:style[@"lightColor"] ?: @""];
    }

    messageCellDynamicColor =
        [[UIColor alloc] initWithDynamicProvider:^UIColor *(UITraitCollection *traitCollection) {
            return [self isDiscordDarkMode] ? messageCellDarkColor : messageCellLightColor;
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
    if ([NSStringFromClass([view class]) isEqualToString:@"DCDMessageTableViewCell"])
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

    if ([NSStringFromClass([view class]) isEqualToString:@"DCDAvatarView"])
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
    static NSSet<NSString *> *mediaClasses = nil;
    static dispatch_once_t    onceToken;
    dispatch_once(&onceToken, ^{
        mediaClasses = [NSSet setWithObjects:@"DiscordChat.MediaMosaicView", @"DiscordChat.EmbedView",
                                              @"DiscordChatComponentsSwift.ThumbnailView",
                                              @"DCDMediaView", @"DiscordChat.AttachmentView", nil];
    });

    NSString *className = NSStringFromClass([view class]);
    BOOL      isMedia   = [mediaClasses containsObject:className] || [className containsString:@"Sticker"];
    return isMedia && !view.hidden && view.bounds.size.width > 0 && view.bounds.size.height > 0;
}

+ (BOOL)hasMessageContent:(UIView *)view
{
    if (view.hidden || CGRectIsEmpty(view.bounds))
        return NO;

    if ([self isMediaView:view])
        return YES;

    if ([NSStringFromClass([view class]) isEqualToString:@"DCDAttributedTextView"])
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
    CGRect              measured = [attrText boundingRectWithSize:CGSizeMake(limit, CGFLOAT_MAX)
                                                            options:NSStringDrawingUsesLineFragmentOrigin
                                                            context:nil];
    CGRect textFrame = [textView convertRect:textView.bounds toView:contentBody];
    return textFrame.origin.x + ceil(measured.size.width);
}

+ (CGRect)tightenFrame:(CGRect)bodyFrame forBody:(UIView *)contentBody
{
    CGFloat contentWidth = [self textWidthIn:contentBody limit:bodyFrame.size.width];

    NSMutableArray<UIView *> *mediaViews = [NSMutableArray array];
    [self collectMediaViewsIn:contentBody into:mediaViews];
    for (UIView *mediaView in mediaViews)
    {
        CGRect mediaFrame = [mediaView convertRect:mediaView.bounds toView:contentBody];
        contentWidth      = MAX(contentWidth, CGRectGetMaxX(mediaFrame));
    }

    if (contentWidth <= 0 || contentWidth >= bodyFrame.size.width)
        return bodyFrame;

    CGRect tightened     = bodyFrame;
    tightened.size.width = contentWidth;
    return tightened;
}

+ (CGRect)contentBubbleFrameForCell:(DCDMessageTableViewCell *)cell
{
    UIView *avatarView = [self findLargestAvatarView:cell.contentView];
    if (!avatarView)
        return CGRectNull;

    UIView *node          = avatarView;
    UIView *contentColumn = nil;
    for (int level = 0; level < 6 && node.superview; level++)
    {
        UIView *parent = node.superview;
        for (UIView *sibling in parent.subviews)
        {
            if (sibling != node && sibling.frame.size.width > node.frame.size.width * 3.0 &&
                sibling.frame.size.width > 100)
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

    CGRect frame = [contentBody convertRect:contentBody.bounds toView:cell];
    frame        = [self tightenFrame:frame forBody:contentBody];
    return CGRectInset(frame, -messageBubbleHorizontalPadding, -messageBubbleVerticalPadding);
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

    cell.customBackgroundView.layer.cornerRadius = messageBubbleRadius;
}

+ (void)updateMessageCellFrame:(DCDMessageTableViewCell *)cell
{
    [self updateMessageCellFrame:cell retriesRemaining:3];
}

+ (void)updateMessageCellFrame:(DCDMessageTableViewCell *)cell retriesRemaining:(int)retriesRemaining
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

    if (customAvatarRadius)
    {
        self.layer.cornerRadius = [customAvatarRadius floatValue];
    }
    else
    {
        self.layer.cornerRadius = self.bounds.size.width / 2.0;
    }
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
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.5 * NSEC_PER_SEC), dispatch_get_main_queue(),
                   ^{ [ChatUI reloadPreferences]; });
}
