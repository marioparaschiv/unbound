#import <UIKit/UIKit.h>

#import "Utilities.h"

extern const CGFloat DYNAMIC_ISLAND_TOP_INSET;

@interface Utilities (DynamicIsland)

+ (BOOL)deviceHasDynamicIsland;
+ (void)initializeDynamicIslandOverlay;
+ (void)showDynamicIslandOverlay;
+ (void)hideDynamicIslandOverlay;

@end

@interface Utilities (DynamicIslandPrivate)

+ (UIImage *)createLogoImage;
+ (void)createDynamicIslandOverlayView;

@end
