import os
import re

for root, dirs, files in os.walk("src"):
    for file in files:
        if "TestRunner.ts" in file or "SmokeTest.ts" in file:
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
            
            # Find all public methods that might need to be async
            content = re.sub(r'public (run[a-zA-Z0-9_]+)\([^)]*\)\s*:\s*([a-zA-Z0-9_]+)\s*\{', r'public async \1(): Promise<\2> {', content)
            # Find tests methods returning TestCaseResult
            content = re.sub(r'private (test[a-zA-Z0-9_]+)\([^)]*\)\s*:\s*(TestCaseResult)\s*\{', r'private async \1(): Promise<\2> {', content)
            
            # Fix tests calls inside runAllTests
            content = re.sub(r'results\.push\((this\.test[a-zA-Z0-9_]+\(\))\);', r'results.push(await \1);', content)
            
            with open(filepath, 'w') as f:
                f.write(content)

# And in server.ts, update calls to those runners
with open("server.ts", "r") as f:
    server = f.read()

server = server.replace("phase0TestRunner.runAllTests()", "await phase0TestRunner.runAllTests()")
server = server.replace("const runner = new Phase1TestRunner();\n    const results = runner.runTestSuite();", "const runner = new Phase1TestRunner();\n    const results = await runner.runTestSuite();")
server = server.replace("const runner = new Phase2TestRunner();\n    const results = runner.runTestSuite();", "const runner = new Phase2TestRunner();\n    const results = await runner.runTestSuite();")
server = server.replace("const runner = new Phase3TestRunner();\n    const results = runner.runTestSuite();", "const runner = new Phase3TestRunner();\n    const results = await runner.runTestSuite();")
# phase 4, 5, 6, provisioning are already async and awaited

with open("server.ts", "w") as f:
    f.write(server)
