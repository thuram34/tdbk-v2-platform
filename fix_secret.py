import re

with open("src/kernel/configuration/configManager.ts", "r") as f:
    content = f.read()

content = content.replace(
    "masterAuthSecret?: string;", 
    "masterAuthSecret?: string;\n  mpesaPasskey?: string;"
)

content = content.replace(
    "masterAuthSecret: process.env.MASTER_AUTH_SECRET || 'tdbk_master_secret_key_v2_internal_fallback',",
    "masterAuthSecret: process.env.MASTER_AUTH_SECRET || 'tdbk_master_secret_key_v2_internal_fallback',\n      mpesaPasskey: process.env.MPESA_PASSKEY,"
)

# Enforce MPESA_PASSKEY
content = content.replace(
    "throw new Error('FATAL: MASTER_AUTH_SECRET is required in production environment.');\n    }",
    "throw new Error('FATAL: MASTER_AUTH_SECRET is required in production environment.');\n    }\n    if (!process.env.MPESA_PASSKEY && process.env.NODE_ENV === 'production') {\n      throw new Error('FATAL: MPESA_PASSKEY is required in production environment.');\n    }"
)

with open("src/kernel/configuration/configManager.ts", "w") as f:
    f.write(content)


with open("src/orchestration/bridge/adapters/mpesaBridge.ts", "r") as f:
    content = f.read()

import_statement = "import { configManager } from '../../../kernel/configuration/configManager';"
if "import { configManager }" not in content:
    content = content.replace("import { KernelError }", import_statement + "\nimport { KernelError }")


getter_replacement = """  private get secretPasskey(): string {
    const secrets = configManager.getPrivateSecrets();
    if (!secrets.mpesaPasskey && process.env.NODE_ENV === 'production') {
      throw new KernelError('INTERNAL_ERROR', 'MPESA_PASSKEY is required in production environment', 500, 'system');
    }
    return secrets.mpesaPasskey || 'safaricom_secret_passkey_123_fallback'; // Fallback for testing only
  }"""

content = re.sub(r'  private get secretPasskey\(\): string \{[\s\S]*?\}', getter_replacement, content)

with open("src/orchestration/bridge/adapters/mpesaBridge.ts", "w") as f:
    f.write(content)
