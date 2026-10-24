#import "Evaluations.h"

#import "Logger.h"

NSString *const EvaluationsDidRecordNotification = @"EvaluationsDidRecord";

static const NSUInteger kHistoryLimit       = 50;
static const NSUInteger kStoredFieldLimit   = 16384;
static const NSUInteger kStoredLogLineLimit = 200;
static const NSUInteger kSyslogFieldLimit   = 512;

static NSString *truncated(NSString *string, NSUInteger limit)
{
    if (string.length <= limit)
    {
        return string;
    }

    NSUInteger end = [string rangeOfComposedCharacterSequenceAtIndex:limit].location;

    return [NSString stringWithFormat:@"%@... (%lu more characters)",
                                      [string substringToIndex:end],
                                      (unsigned long) (string.length - end)];
}

static NSString *levelName(EvaluationLogLevel level)
{
    switch (level)
    {
        case EvaluationLogLevelLog:
            return @"log";
        case EvaluationLogLevelWarn:
            return @"warn";
        case EvaluationLogLevelError:
            return @"error";
    }

    return @"log";
}

@implementation EvaluationLogLine

- (instancetype)initWithLevel:(EvaluationLogLevel)level message:(NSString *)message
{
    if ((self = [super init]))
    {
        _level   = level;
        _message = [truncated(message, kStoredFieldLimit) copy];
    }

    return self;
}

@end

@implementation EvaluationRecord

- (instancetype)initWithIdentifier:(NSString *)identifier
                              code:(NSString *)code
                                ok:(BOOL)ok
                             value:(NSString *)value
                             error:(NSString *)error
                              logs:(NSArray<EvaluationLogLine *> *)logs
{
    if ((self = [super init]))
    {
        _identifier = [identifier copy];
        _code       = [truncated(code, kStoredFieldLimit) copy];
        _ok         = ok;
        _value      = value ? [truncated(value, kStoredFieldLimit) copy] : nil;
        _error      = error ? [truncated(error, kStoredFieldLimit) copy] : nil;
        _logs       = logs.count > kStoredLogLineLimit
                          ? [logs subarrayWithRange:NSMakeRange(0, kStoredLogLineLimit)]
                          : [logs copy];
        _date       = [NSDate date];
    }

    return self;
}

@end

@implementation Evaluations

static NSMutableArray<EvaluationRecord *> *gHistory;
static dispatch_queue_t                   gQueue;

+ (void)initialize
{
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        gHistory = [NSMutableArray arrayWithCapacity:kHistoryLimit];
        gQueue   = dispatch_queue_create("app.unbound.evaluations", DISPATCH_QUEUE_SERIAL);
    });
}

+ (void)record:(EvaluationRecord *)record
{
    dispatch_async(gQueue, ^{
        @synchronized(gHistory)
        {
            [gHistory addObject:record];
            if (gHistory.count > kHistoryLimit)
            {
                [gHistory removeObjectsInRange:NSMakeRange(0, gHistory.count - kHistoryLimit)];
            }
        }

        NSString *outcome = record.ok ? truncated(record.value ?: @"undefined", kSyslogFieldLimit)
                                      : truncated(record.error ?: @"unknown error", kSyslogFieldLimit);

        [Logger log:record.ok ? LogLevelInfo : LogLevelError
            category:LOG_CATEGORY_DEBUGGER
              format:@"Eval %@ %@ (%lu console lines)\n> %@\n< %@", record.identifier,
                     record.ok ? @"succeeded" : @"failed", (unsigned long) record.logs.count,
                     truncated(record.code, kSyslogFieldLimit), outcome];

        for (EvaluationLogLine *line in record.logs)
        {
            [Logger log:line.level == EvaluationLogLevelError  ? LogLevelError
                        : line.level == EvaluationLogLevelWarn ? LogLevelNotice
                                                               : LogLevelInfo
                category:LOG_CATEGORY_DEBUGGER
                  format:@"Eval %@ [%@] %@", record.identifier, levelName(line.level),
                         truncated(line.message, kSyslogFieldLimit)];
        }

        [[NSNotificationCenter defaultCenter] postNotificationName:EvaluationsDidRecordNotification
                                                            object:record];
    });
}

+ (NSArray<EvaluationRecord *> *)history
{
    @synchronized(gHistory)
    {
        return [gHistory copy];
    }
}

@end
