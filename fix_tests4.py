for phase, name in [(1, "Phase1TestRunner"), (2, "Phase2TestRunner"), (3, "Phase3TestRunner")]:
    filepath = f"src/{['blueprint', 'capability', 'orchestration'][phase-1]}/tests/phase{phase}.test.ts"
    with open(filepath, "r") as f:
        content = f.read()
    content = content.replace("testCase.status", "testCase.passed ? 'PASSED' : 'FAILED'")
    content = content.replace("testCase.testId", "testCase.id")
    content = content.replace("testCase.actualResult", "testCase.error || ''")
    
    with open(filepath, "w") as f:
        f.write(content)
