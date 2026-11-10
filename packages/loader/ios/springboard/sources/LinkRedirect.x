#import <Foundation/Foundation.h>

// Discord keeps its App Store signature, so UnboundLink.app claims unbound://. SpringBoard hands
// those opens to Discord directly; if this hook stops matching, UnboundLink relays them instead.
static NSString *const kRelayBundleId   = @"app.unbound.link";
static NSString *const kDiscordBundleId = @"com.hammerandchisel.discord";
static NSString *const kUnboundPrefix   = @"unbound://";
static NSString *const kRelayPrefix     = @"com.hammerandchisel.discord://unbound/";
static NSString *const kPayloadURLKey   = @"__PayloadURL";

@interface FBSOpenApplicationOptions : NSObject
@property (copy, nonatomic) NSDictionary *dictionary;
+ (instancetype)optionsWithDictionary:(NSDictionary *)dictionary;
@end

@interface FBSystemServiceOpenApplicationRequest : NSObject
@property (copy, nonatomic) NSString                  *bundleIdentifier;
@property (strong, nonatomic) FBSOpenApplicationOptions *options;
@end

static NSString *discordLink(NSString *link)
{
    if (link.length <= kUnboundPrefix.length ||
        [link rangeOfString:kUnboundPrefix options:NSCaseInsensitiveSearch | NSAnchoredSearch].location == NSNotFound)
    {
        return nil;
    }
    return [kRelayPrefix stringByAppendingString:[link substringFromIndex:kUnboundPrefix.length]];
}

static void redirectToDiscord(FBSystemServiceOpenApplicationRequest *request)
{
    NSMutableDictionary *dictionary = [request.options.dictionary mutableCopy];
    id                   payload    = dictionary[kPayloadURLKey];
    BOOL                 isURL      = [payload isKindOfClass:NSURL.class];
    NSString *link = discordLink(isURL ? [payload absoluteString] : ([payload isKindOfClass:NSString.class] ? payload : nil));
    NSURL    *url  = link ? [NSURL URLWithString:link] : nil;
    if (!url)
    {
        return;
    }
    dictionary[kPayloadURLKey]         = isURL ? url : link;
    FBSOpenApplicationOptions *options = [%c(FBSOpenApplicationOptions) optionsWithDictionary:dictionary];
    // Leave the request for UnboundLink.app unless the rewrite is complete.
    if (!options)
    {
        return;
    }
    request.options          = options;
    request.bundleIdentifier = kDiscordBundleId;
}

%hook SBMainWorkspace

- (void)systemService:(id)service
    handleOpenApplicationRequest:(FBSystemServiceOpenApplicationRequest *)request
                  withCompletion:(id)completion
{
    if ([request.bundleIdentifier isEqualToString:kRelayBundleId])
    {
        redirectToDiscord(request);
    }
    %orig;
}

%end
