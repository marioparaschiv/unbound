#import <Foundation/Foundation.h>
#import <CoreFoundation/CoreFoundation.h>
#import <dlfcn.h>
#import "Logger.h"

NS_ASSUME_NONNULL_BEGIN

typedef CFTypeRef _Nullable (*MGCopyAnswerFunction)(CFStringRef key);

@interface MobileGestalt : NSObject

+ (instancetype)sharedInstance;

- (nullable NSString *)getBuildVersion;
- (nullable NSString *)getPhysicalHardwareNameString;

@end

NS_ASSUME_NONNULL_END
