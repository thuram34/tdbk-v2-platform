with open("server.ts", "r") as f:
    content = f.read()

import re

# Fix all app.get, app.post, etc to be async if they have await inside
content = re.sub(r'app\.(get|post|put|delete)\(\'([^\']+)\',\s*\((req,\s*res)\)\s*=>\s*\{', r'app.\1(\'\2\', async (\3) => {', content)

with open("server.ts", "w") as f:
    f.write(content)
