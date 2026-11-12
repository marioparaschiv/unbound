#import <UIKit/UIKit.h>

#import "Fonts.h"

@interface RCTParagraphComponentView : UIView
- (NSAttributedString *)attributedText;
@end

@interface RCTTextLayoutManager : NSObject
@end

// Centres each line of a replacement font in React Native's fixed line box, set on the layout
// managers of text that draws one.
@interface FontLineCentring : NSObject <NSLayoutManagerDelegate>
@end
