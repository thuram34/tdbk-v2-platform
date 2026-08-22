import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Change createSecurityContext calls to await
    # from: securityContextFactory.createSecurityContext(
    # to: await securityContextFactory.createSecurityContext(
    content = content.replace("securityContextFactory.createSecurityContext(", "await securityContextFactory.createSecurityContext(")

    # In server.ts, we need to make sure the app.get/post handlers are async
    if filepath.endswith("server.ts"):
        # Match app.get('/...', (req, res) => {
        content = re.sub(r'(app\.(?:get|post|put|delete)\([^,]+,\s*)(req(?:uest)?:\s*Request,\s*res(?:ponse)?:\s*Response\)\s*=>)', r'\1async \2', content)
        # Or without type annotations
        content = re.sub(r'(app\.(?:get|post|put|delete)\([^,]+,\s*)\(req,\s*res\)\s*=>', r'\1async (req, res) =>', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Processed {filepath}")

for root, dirs, files in os.walk("src"):
    for file in files:
        if file.endswith(".ts") or file.endswith(".tsx"):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                if "createSecurityContext" in f.read():
                    process_file(filepath)

if os.path.exists("server.ts"):
    process_file("server.ts")
