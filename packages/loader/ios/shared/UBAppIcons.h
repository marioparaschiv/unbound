#import <Foundation/Foundation.h>

#ifdef __cplusplus
extern "C" {
#endif

extern NSString *const UBIconNamesKey;

NSArray<NSDictionary *> *UBCustomIcons(NSString *documentsDirectory);
BOOL                     UBSyncCustomIconFiles(NSString *bundlePath, NSArray<NSDictionary *> *icons);
NSArray<NSDictionary *> *UBRenderableIcons(NSString *bundlePath, NSArray<NSDictionary *> *icons);
void                     UBAddAlternateIcon(NSMutableDictionary *info, NSString *iconId);
void                     UBAddCustomIcons(NSMutableDictionary *info, NSArray<NSDictionary *> *icons);

#ifdef __cplusplus
}
#endif
