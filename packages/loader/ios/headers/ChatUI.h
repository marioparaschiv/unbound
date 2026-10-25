#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import "Discord.h"
#import "Logger.h"
#import "Utilities.h"

@interface ChatUI : NSObject

+ (void)reloadPreferences;

+ (void)updateMessageCell:(DCDMessageTableViewCell *)cell;

@end
