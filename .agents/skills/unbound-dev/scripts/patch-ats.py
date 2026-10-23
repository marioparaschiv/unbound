#!/usr/bin/env python3
"""Allow plain-HTTP loads in an IPA by setting NSAllowsArbitraryLoads in the app's Info.plist.

  patch-ats.py <in.ipa> <out.ipa>

Copies every other entry unchanged.
"""

import plistlib
import re
import sys
import zipfile

if len(sys.argv) != 3:
    sys.exit(__doc__)

with zipfile.ZipFile(sys.argv[1]) as src, zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED) as dst:
    for info in src.infolist():
        data = src.read(info.filename)

        if re.fullmatch(r'Payload/[^/]+\.app/Info\.plist', info.filename):
            plist = plistlib.loads(data)
            plist['NSAppTransportSecurity'] = {'NSAllowsArbitraryLoads': True}
            data = plistlib.dumps(plist, fmt=plistlib.FMT_BINARY)

        dst.writestr(info, data)

print('patched', sys.argv[2])
