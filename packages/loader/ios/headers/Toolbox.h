#import <Foundation/Foundation.h>
#import <SafariServices/SafariServices.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <objc/message.h>
#import <spawn.h>
#import <sys/utsname.h>

#import "FileSystem.h"
#import "MobileGestalt.h"
#import "Settings.h"
#import "Updater.h"
#import "Utilities.h"

#ifdef __cplusplus
extern "C" {
#endif
void showToolboxSheet(void);
#ifdef __cplusplus
}
#endif

@interface Toolbox : NSObject
+ (void)showToolboxMenu;
@end

@interface ToolboxViewController : UIViewController <UITableViewDelegate,
                                                     UITableViewDataSource,
                                                     SFSafariViewControllerDelegate,
                                                     UIGestureRecognizerDelegate>

@property (nonatomic, strong) UITableView *tableView;
@property (nonatomic, strong) UIView      *cardView;

- (void)dismiss;

@end

@interface                                             ToolboxViewController ()
@property (nonatomic, strong) NSDictionary            *menu;
@property (nonatomic, strong) NSArray<NSDictionary *> *menuSections;
@end
