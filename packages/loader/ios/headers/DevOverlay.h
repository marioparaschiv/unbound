#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import "ChatUI.h"
#import "Settings.h"
#import "Toolbox.h"
#import "Utilities.h"

@interface DevOverlay : NSObject

+ (void)ensureOverlayForWindow:(UIWindow *)keyWindow;
+ (void)refreshOverlay;
+ (void)showDevelopmentBuildBanner;

@end
