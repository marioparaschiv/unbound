#import "MobileGestalt.h"

@interface                                 MobileGestalt ()
@property (nonatomic) void                *handle;
@property (nonatomic) MGCopyAnswerFunction copyAnswerRef;
@end

@implementation MobileGestalt

+ (instancetype)sharedInstance
{
    static MobileGestalt  *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{ sharedInstance = [[self alloc] init]; });
    return sharedInstance;
}

- (instancetype)init
{
    self = [super init];
    if (self)
    {
        self.handle = dlopen("/usr/lib/libMobileGestalt.dylib", RTLD_LAZY);
        if (self.handle)
        {
            void *sym = dlsym(self.handle, "MGCopyAnswer");
            if (sym)
            {
                self.copyAnswerRef = (MGCopyAnswerFunction) sym;
                [Logger debug:LOG_CATEGORY_UTILITIES format:@"MGCopyAnswer loaded successfully"];
            }
            else
            {
                [Logger error:LOG_CATEGORY_UTILITIES format:@"Failed to load MGCopyAnswer symbol"];
                self.copyAnswerRef = NULL;
            }
        }
        else
        {
            [Logger error:LOG_CATEGORY_UTILITIES format:@"Failed to load libMobileGestalt.dylib"];
            self.copyAnswerRef = NULL;
        }
    }
    return self;
}

- (void)dealloc
{
    if (self.handle)
    {
        dlclose(self.handle);
        [Logger debug:LOG_CATEGORY_UTILITIES format:@"dlclose called on MobileGestalt handle"];
    }
}

- (nullable NSString *)getValueForKey:(NSString *)key
{
    [Logger debug:LOG_CATEGORY_UTILITIES format:@"Querying MobileGestalt for key: %@", key];

    if (!self.copyAnswerRef)
    {
        [Logger error:LOG_CATEGORY_UTILITIES format:@"MGCopyAnswer not available"];
        return nil;
    }

    CFTypeRef result = self.copyAnswerRef((__bridge CFStringRef) key);
    if (!result)
    {
        [Logger debug:LOG_CATEGORY_UTILITIES format:@"No value for key: %@", key];
        return nil;
    }

    NSString *stringValue = [self cfTypeRefToString:result];
    CFRelease(result);
    return stringValue;
}

- (nullable NSString *)cfTypeRefToString:(CFTypeRef)ref
{
    if (!ref)
        return nil;

    CFTypeID typeID = CFGetTypeID(ref);

    if (typeID == CFStringGetTypeID())
    {
        return (__bridge NSString *) ref;
    }
    else if (typeID == CFBooleanGetTypeID())
    {
        Boolean boolValue = CFBooleanGetValue((CFBooleanRef) ref);
        return boolValue ? @"true" : @"false";
    }
    else if (typeID == CFNumberGetTypeID())
    {
        NSNumber *number = (__bridge NSNumber *) ref;
        return [number stringValue];
    }
    else if (typeID == CFDataGetTypeID())
    {
        NSData   *data   = (__bridge NSData *) ref;
        NSString *string = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (string)
        {
            return [string stringByTrimmingCharactersInSet:[NSCharacterSet newlineCharacterSet]];
        }
    }

    return nil;
}

- (nullable NSString *)getBuildVersion
{
    return [self getValueForKey:@"BuildVersion"];
}

- (nullable NSString *)getPhysicalHardwareNameString
{
    return [self getValueForKey:@"PhysicalHardwareNameString"];
}

@end
