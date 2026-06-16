import sys

# 1. Update frontend interface
file_path_frontend = "client/src/features/learner/pages/Dashboard.tsx"
with open(file_path_frontend, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("psaBirthCertNumber: string | null;", "psaBirthCertNumber: string | null;\n    studentPhoto: string | null;")

with open(file_path_frontend, "w", encoding="utf-8") as f:
    f.write(content)

# 2. Update backend payload
file_path_backend = "server/src/features/learner/learner.controller.ts"
with open(file_path_backend, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("psaBirthCertNumber: sanitizeStr(learner.psaBirthCertNumber),", "psaBirthCertNumber: sanitizeStr(learner.psaBirthCertNumber),\n    studentPhoto: learner.studentPhoto,")

with open(file_path_backend, "w", encoding="utf-8") as f:
    f.write(content)

print("studentPhoto patched.")
