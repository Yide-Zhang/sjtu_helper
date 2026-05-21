# -*- coding: utf-8 -*-
import re

seg = u'2\u3001\u62a2\u9009\uff1a6\u67083\u65e5\uff08\u7b2c16\u5468\u5468\u4e8c\uff0920:45-6\u67086\u65e5\uff08\u7b2c16\u5468\u5468\u4e94\uff0917:00\u3002\u5176\u4e2d\u5728\u62a2\u9009\u540e\u534a\u9636\u6bb5\uff0c\u53736\u67084\u65e5\uff08\u7b2c16\u5468\u5468\u4e09\uff0915:00-20:45\u5c06\u6682\u505c\u9009\u8bfe'

print(u'Contains \u62a2\u9009:', u'\u62a2\u9009' in seg)
print(u'Contains \u9636\u6bb5:', u'\u9636\u6bb5' in seg)  
print(u'Contains \u8f6e:', u'\u8f6e' in seg)
print(u'Match result:', (u'\u62a2\u9009' in seg and u'\u9636\u6bb5' not in seg and u'\u8f6e' not in seg))
