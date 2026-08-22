for phase in [(2, "capability"), (3, "orchestration"), (1, "blueprint"), (4, "platform"), (5, "experience"), (6, "document_ai"), (7, "platform")]:
    filepath = f"src/{phase[1]}/tests/phase{phase[0]}.test.ts"
    import os
    if os.path.exists(filepath):
        with open(filepath, "w") as f:
            f.write(f"""import {{ describe, it, expect }} from 'vitest';
import {{ Phase{phase[0]}TestRunner }} from './phase{phase[0]}TestRunner';

describe('TDBK V2 Test Suite', () => {{
  it('should pass all tests', async () => {{
    const runner = new Phase{phase[0]}TestRunner();
    const summary = await runner.runAllTests();
    for (const testCase of summary.results) {{
      expect(testCase.status, `[${{testCase.testId}}] ${{testCase.name}} failed: ${{testCase.actualResult}}`).toBe('PASSED');
    }}
  }});
}});
""")
