#pragma once

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>


@interface DCDAvatarView : UIView
@end

@interface                            DCDMessageTableViewCell : UITableViewCell
@property (nonatomic, strong) UIView *customBackgroundView;
@property (nonatomic, strong) UIView *innerView;
@end

@interface DCDSeparatorTableViewCell : UITableViewCell
@end

@interface DCDThemeColor : NSObject
+ (UIColor *)BACKGROUND_PRIMARY;
@end

@interface DCDThemeModule : NSObject
- (void)updateTheme:(id)theme;
@end

@interface DCDBundleUpdaterManager : NSObject
- (void)reload;
@end
