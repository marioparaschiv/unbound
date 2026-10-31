#import "Debug.h"

#ifdef DEBUG

#import "CoreConversions.h"
#include "LoaderDiagnostics.h"

using unbound::ios::toStdString;

static std::string stringValue(id value)
{
    return [value isKindOfClass:[NSString class]] ? toStdString(value) : std::string();
}

static loader::diagnostics::ErrorReport errorReport(NSString *domain, NSInteger code, id userInfo)
{
    NSDictionary *info = [userInfo isKindOfClass:[NSDictionary class]] ? userInfo : nil;

    loader::diagnostics::ErrorReport report;
    report.domain               = stringValue(domain);
    report.code                 = code;
    report.userInfoCount        = info.count;
    report.filePath             = stringValue(info[@"NSFilePath"]);
    report.localizedDescription = stringValue(info[NSLocalizedDescriptionKey]);
    report.message              = stringValue(info[@"Message"]);
    report.terminated           = info[@"Terminated"] != nil;

    id underlying = info[@"NSUnderlyingError"];
    if ([underlying isKindOfClass:[NSError class]])
    {
        report.underlyingError = loader::diagnostics::UnderlyingError{
            stringValue(((NSError *) underlying).domain), ((NSError *) underlying).code};
    }
    else
    {
        report.underlyingText = stringValue(underlying);
    }

    id url = info[@"NSURL"];
    if ([url isKindOfClass:[NSURL class]])
    {
        report.url = stringValue([url absoluteString]);
    }
    return report;
}

static BOOL shouldIgnoreError(NSString *domain, NSInteger code, id info)
{
    return loader::diagnostics::isIgnoredError(errorReport(domain, code, info));
}

%hook NSError
- (id)initWithDomain:(id)domain code:(int)code userInfo:(id)userInfo
{
    if (!shouldIgnoreError(domain, code, userInfo))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"NSError %@ (%d) %@", domain, code, userInfo];
    }
    return %orig;
}

+ (id)errorWithDomain:(id)domain code:(int)code userInfo:(id)userInfo
{
    if (!shouldIgnoreError(domain, code, userInfo))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"NSError %@ (%d) %@", domain, code, userInfo];
    }
    return %orig;
}
%end

static BOOL shouldIgnoreException(id name)
{
    return loader::diagnostics::isIgnoredException(stringValue(name));
}

%hook NSException
- (id)initWithName:(id)name reason:(id)reason userInfo:(id)userInfo
{
    if (!shouldIgnoreException(name))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"NSException %@: %@ %@", name, reason, userInfo];
    }
    return %orig;
}

+ (id)exceptionWithName:(id)name reason:(id)reason userInfo:(id)userInfo
{
    if (!shouldIgnoreException(name))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"NSException %@: %@ %@", name, reason, userInfo];
    }
    return %orig;
}
%end

%ctor
{
    %init();
}

#endif
