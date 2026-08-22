for phase, name in [(1, "Phase1TestRunner"), (2, "Phase2TestRunner"), (3, "Phase3TestRunner")]:
    filepath = f"src/{['blueprint', 'capability', 'orchestration'][phase-1]}/tests/phase{phase}.test.ts"
    with open(filepath, "r") as f:
        content = f.read()
    content = content.replace(f"const runner = new {name}();\n    const summary = await runner.runAllTests();", f"const runner = new {name}();\n    const summary = await runner.runAllTests();")
    content = content.replace(f"const summary = await {name}.runAllTests();", f"const runner = new {name}();\n    const summary = await runner.runAllTests();")
    
    with open(filepath, "w") as f:
        f.write(content)

for phase, name, func in [(4, "platform", "runPhase4TestSuite"), (5, "experience", "runPhase5TestSuite"), (6, "document_ai", "runPhase6TestSuite"), (7, "platform", "runPhase7TestSuite")]:
    filepath = f"src/{name}/tests/phase{phase}.test.ts"
    with open(filepath, "w") as f:
        f.write(f"""import {{ describe, it, expect }} from 'vitest';
import {{ {func} }} from './phase{phase}TestRunner';

describe('TDBK V2 Test Suite', () => {{
  it('should pass all tests', async () => {{
    const summary = await {func}();
    for (const testCase of summary.results) {{
      expect(testCase.status, `[${{testCase.id}}] ${{testCase.name}} failed: ${{testCase.actualResult || testCase.details || ''}}`).toBe('PASSED');
    }}
  }});
}});
""")
