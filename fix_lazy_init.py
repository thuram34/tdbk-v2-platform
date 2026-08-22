with open("src/kernel/identity/tokenVerifier.ts", "r") as f:
    content = f.read()

content = content.replace("const auth = typeof admin.auth === 'function' ? admin.auth() : admin.default.auth();", "const auth = (admin.auth && typeof admin.auth === 'function') ? admin.auth() : (admin.default && admin.default.auth ? admin.default.auth() : (admin.verifyIdToken ? admin : null));")

with open("src/kernel/identity/tokenVerifier.ts", "w") as f:
    f.write(content)
