with open("src/orchestration/bridge/adapters/mpesaBridge.ts", "r") as f:
    content = f.read()

import re

# Correct getter replacement, ensuring no duplicate returns
getter_replacement = """  private get secretPasskey(): string {
    const secrets = configManager.getPrivateSecrets();
    if (!secrets.mpesaPasskey && process.env.NODE_ENV === 'production') {
      throw new KernelError('INTERNAL_ERROR', 'MPESA_PASSKEY is required in production environment', 500, 'system');
    }
    return secrets.mpesaPasskey || 'safaricom_secret_passkey_123_fallback'; // Fallback for testing only
  }"""

content = re.sub(r'  private get secretPasskey\(\): string \{[\s\S]*?\}', getter_replacement, content)
content = re.sub(r'    return key \|\|.*?\}\s*\}', '  }', content)

with open("src/orchestration/bridge/adapters/mpesaBridge.ts", "w") as f:
    f.write(content)
