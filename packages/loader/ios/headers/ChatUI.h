#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import "Discord.h"
#import "Logger.h"
#import "Utilities.h"

@interface ChatUI : NSObject

+ (void)setAvatarCornerRadius:(NSNumber *)radius;
+ (NSNumber *)getAvatarCornerRadius;
+ (void)resetAvatarCornerRadius;
+ (float)getCurrentAvatarRadius;

+ (void)setMessageBubblesEnabled:(NSNumber *)enabled;
+ (void)setMessageBubblesEnabled:(NSNumber *)enabled
                      lightColor:(NSString *)lightColor
                       darkColor:(NSString *)darkColor;
+ (void)setMessageBubbleColors:(NSString *)lightColor darkColor:(NSString *)darkColor;
+ (void)setMessageBubbleCornerRadius:(NSNumber *)radius;
+ (NSNumber *)getMessageBubblesEnabled;
+ (NSString *)getMessageBubbleLightColor;
+ (NSString *)getMessageBubbleDarkColor;
+ (NSNumber *)getMessageBubbleCornerRadius;
+ (void)resetMessageBubbles;

+ (void)updateMessageCell:(DCDMessageTableViewCell *)cell;

@end
