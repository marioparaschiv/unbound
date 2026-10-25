#import "Unbound.h"

#ifdef __cplusplus
extern "C" {
#endif
extern NSString *const SettingsDidChangeNotification;
#ifdef __cplusplus
}
#endif

@interface Settings : NSObject
{
    NSDictionary *data;
    NSString     *path;
}

+ (NSDictionary *)getDictionary:(NSString *)store key:(NSString *)key def:(NSDictionary *)def;
+ (NSString *)getString:(NSString *)store key:(NSString *)key def:(NSString *)def;
+ (BOOL)getBoolean:(NSString *)store key:(NSString *)key def:(BOOL)def;
+ (void)set:(NSString *)store key:(NSString *)key value:(id)value;
+ (void)loadSettings;
+ (void)reset;
+ (void)init;
+ (void)save;

@end
