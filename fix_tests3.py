for phase, name in [(1, "Phase1TestRunner"), (2, "Phase2TestRunner"), (3, "Phase3TestRunner")]:
    filepath = f"src/{['blueprint', 'capability', 'orchestration'][phase-1]}/tests/phase{phase}.test.ts"
    with open(filepath, "r") as f:
        content = f.read()
    content = content.replace(f"const runner = new {name}();\n    const summary = await runner.runAllTests();", f"const summary = await {name}.runAllTests();")
    
    with open(filepath, "w") as f:
        f.write(content)

for phase, name in [(4, "platform"), (5, "experience"), (6, "document_ai"), (7, "platform")]:
    filepath = f"src/{name}/tests/phase{phase}.test.ts"
    with open(filepath, "r") as f:
        content = f.read()
    content = content.replace("testCase.actualResult || ", "")
    with open(filepath, "w") as f:
        f.write(content)
