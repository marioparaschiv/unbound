#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

// A small "Updating Unbound…" pill shown while Discord's launch waits for Unbound's bundle.
@interface UpdateBanner : NSObject

+ (void)show;
+ (void)hide;

@end
