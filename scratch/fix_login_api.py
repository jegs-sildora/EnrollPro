import os

smart_dir = "c:/Users/localhost/Documents/Enrollpro/client/src/features/smart"

for root, dirs, files in os.walk(smart_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace const API_URL = "/api";
            if 'const API_URL = "/api"' in content:
                print(f"Fixing API_URL in {file}")
                content = content.replace('const API_URL = "/api"', 'const API_URL = "/smart-api/api"')
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
