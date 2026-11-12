.findings as $findings
| {
    channel: $channel,
    scans: [
      .targets[]
      | select((.version // "") != "")
      | . as $target
      | {platform: $target.platform, version: $target.version}
      + (if ($target.build // "") != "" then {build: $target.build} else {} end)
      + {
          broken: ([$findings[] | select(.platform == $target.platform and .status == "broken")] | length),
          fallbacks: ([$findings[] | select(.platform == $target.platform and .status == "fallback")] | length)
        }
    ]
  }
