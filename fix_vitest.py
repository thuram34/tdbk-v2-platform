import os
import re

for file in ["src/blueprint/tests/phase1.test.ts", "src/capability/tests/phase2.test.ts", "src/orchestration/tests/phase3.test.ts", "src/kernel/tests/runtimeSmoke.test.ts", "src/platform/tests/phase4.test.ts", "src/experience/tests/phase5.test.ts", "src/document_ai/tests/phase6.test.ts", "src/platform/tests/phase7.test.ts", "src/platform/tests/dbkProvisioning.test.ts", "src/experience/tests/multiBusiness.test.ts"]:
    if not os.path.exists(file):
        continue
    with open(file, 'r') as f:
        content = f.read()

    # If it generates dynamic it() blocks, wrap it in a single it() block
    if "for (const testCase of" in content:
        runner_match = re.search(r'const\s+(summary|suiteResults|res)\s*=\s*await\s+([A-Za-z0-9_]+)\.runAllTests\(\);', content)
        if runner_match:
            var_name = runner_match.group(1)
            runner_name = runner_match.group(2)
            
            new_content = f"""import {{ describe, it, expect }} from 'vitest';
import {{ {runner_name} }} from './{runner_name}';

describe('TDBK V2 Test Suite', () => {{
  it('should pass all tests', async () => {{
    const {var_name} = await {runner_name}.runAllTests();
    for (const testCase of {var_name}.results) {{
      expect(testCase.status, `[${{testCase.testId}}] ${{testCase.name}} failed: ${{testCase.actualResult}}`).toBe('PASSED');
    }}
  }});
}});
"""
            with open(file, 'w') as f:
                f.write(new_content)
