#import "Settings.h"

NSString *const SettingsDidChangeNotification = @"SettingsDidChange";

static const NSTimeInterval kSettingsSaveDebounce = 0.3;

@implementation Settings
static NSMutableDictionary *data      = nil;
static NSString            *path      = nil;
static dispatch_source_t    saveTimer = nil;

static NSRecursiveLock *settingsLock(void)
{
    static NSRecursiveLock *lock = nil;
    static dispatch_once_t  onceToken;
    dispatch_once(&onceToken, ^{ lock = [[NSRecursiveLock alloc] init]; });
    return lock;
}

+ (void)init
{
    path = [NSString pathWithComponents:@[ FileSystem.documents, @"settings.json" ]];

    [Settings loadSettings];

    [FileSystem monitor:path
               onChange:^{
                   [Settings loadSettings];
                   [[NSNotificationCenter defaultCenter]
                       postNotificationName:SettingsDidChangeNotification
                                     object:nil];
               }
            autoRestart:YES];
}

+ (void)loadSettings
{
    [settingsLock() lock];
    @try
    {
        if (![FileSystem exists:path])
        {
            [Settings reset];
        }

        NSMutableDictionary *parsed = nil;

        @try
        {
            NSData *settings = [FileSystem readFile:path];

            NSError *error;
            parsed = [NSJSONSerialization JSONObjectWithData:settings
                                                      options:NSJSONReadingMutableContainers
                                                        error:&error];

            if (error || ![parsed isKindOfClass:[NSMutableDictionary class]])
            {
                [Logger error:LOG_CATEGORY_SETTINGS
                       format:@"settings.json is corrupt, backing it up and resetting. (%@)", error];
                [Settings backupCorruptSettingsFile];
                [Settings reset];
                parsed = nil;
            }
        }
        @catch (NSException *e)
        {
            [Logger error:LOG_CATEGORY_SETTINGS
                   format:@"Failed to read settings.json, resetting. (%@)", e.reason];
            [Settings backupCorruptSettingsFile];
            [Settings reset];
        }

        data = parsed ?: [NSMutableDictionary dictionary];
    }
    @finally
    {
        [settingsLock() unlock];
    }
}

+ (void)backupCorruptSettingsFile
{
    if (![FileSystem exists:path])
    {
        return;
    }

    NSString *backupPath =
        [NSString stringWithFormat:@"%@.corrupt-%lld", path, (long long) [[NSDate date] timeIntervalSince1970]];

    NSError *error;
    [[NSFileManager defaultManager] copyItemAtPath:path toPath:backupPath error:&error];

    if (error)
    {
        [Logger error:LOG_CATEGORY_SETTINGS
               format:@"Failed to back up corrupt settings.json. (%@)", error];
    }
    else
    {
        [Logger error:LOG_CATEGORY_SETTINGS format:@"Backed up corrupt settings.json to %@", backupPath];
    }
}

+ (id)rawValueForStore:(NSString *)store key:(NSString *)key
{
    [settingsLock() lock];
    id payload = data[store];
    id value   = payload ? [payload valueForKeyPath:key] : nil;
    [settingsLock() unlock];

    return value;
}

+ (NSString *)getString:(NSString *)store key:(NSString *)key def:(NSString *)def
{
    id value = [Settings rawValueForStore:store key:key];

    return value ?: def;
}

+ (NSDictionary *)getDictionary:(NSString *)store key:(NSString *)key def:(NSDictionary *)def
{
    id value = [Settings rawValueForStore:store key:key];

    return value ?: def;
}

+ (BOOL)getBoolean:(NSString *)store key:(NSString *)key def:(BOOL)def
{
    id value = [Settings rawValueForStore:store key:key];

    if (value != nil && [value respondsToSelector:@selector(boolValue)])
    {
        return [value boolValue];
    }

    return def;
}

+ (void)set:(NSString *)store key:(NSString *)key value:(id)value
{
    [settingsLock() lock];
    @try
    {
        if (!data)
        {
            data = [NSMutableDictionary dictionary];
        }

        __block NSMutableDictionary *payload = data[store];

        if (!payload)
        {
            payload     = [NSMutableDictionary dictionary];
            data[store] = payload;
        }

        NSArray                     *keys = [key componentsSeparatedByString:@"."];
        __block NSMutableDictionary *res  = payload;

        for (id key in keys)
        {
            if ([keys count] == ([keys indexOfObject:key] + 1))
            {
                [res setValue:value forKey:key];
                break;
            }

            if (res[key] == nil)
            {
                [res setValue:[NSMutableDictionary dictionary] forKey:key];
            }

            res = res[key];
        }

        [Settings scheduleSave];
    }
    @catch (NSException *e)
    {
        [Logger error:LOG_CATEGORY_SETTINGS format:@"Settings set failed. %@", e];
    }
    @finally
    {
        [settingsLock() unlock];
    }
}

+ (void)reset
{
    NSString *payload = @"{}";

    [FileSystem writeFile:path contents:[payload dataUsingEncoding:NSUTF8StringEncoding]];
}

+ (void)scheduleSave
{
    [settingsLock() lock];

    if (saveTimer)
    {
        dispatch_source_cancel(saveTimer);
    }

    saveTimer = [Utilities createDebounceTimer:kSettingsSaveDebounce
                                          queue:dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0)
                                          block:^{ [Settings save]; }];

    [settingsLock() unlock];
}

+ (void)save
{
    [settingsLock() lock];
    NSString *payload  = [Settings getSettings];
    NSData   *contents = [payload dataUsingEncoding:NSUTF8StringEncoding];
    [settingsLock() unlock];

    [FileSystem writeFile:path contents:contents];
}

+ (NSString *)getSettings
{
    [settingsLock() lock];
    NSString *json = [Utilities JSONStringFromObject:data options:NSJSONWritingPrettyPrinted fallback:@"{}"];
    [settingsLock() unlock];

    return json;
}

+ (BOOL)loadFromJSONString:(NSString *)json error:(NSError **)error
{
    NSData *jsonData = [json dataUsingEncoding:NSUTF8StringEncoding];
    if (!jsonData)
    {
        if (error)
        {
            *error = [NSError errorWithDomain:@"Settings"
                                          code:1
                                      userInfo:@{NSLocalizedDescriptionKey : @"Not valid UTF-8"}];
        }
        return NO;
    }

    NSError *jsonError;
    id parsed = [NSJSONSerialization JSONObjectWithData:jsonData
                                                 options:NSJSONReadingMutableContainers
                                                   error:&jsonError];
    if (jsonError || ![parsed isKindOfClass:[NSMutableDictionary class]])
    {
        if (error)
        {
            *error = jsonError ?: [NSError errorWithDomain:@"Settings"
                                                        code:2
                                                    userInfo:@{
                                                        NSLocalizedDescriptionKey :
                                                            @"Root must be a JSON object"
                                                    }];
        }
        return NO;
    }

    [settingsLock() lock];
    data = parsed;
    [settingsLock() unlock];

    [Settings save];
    [[NSNotificationCenter defaultCenter] postNotificationName:SettingsDidChangeNotification
                                                         object:nil];

    return YES;
}
@end
