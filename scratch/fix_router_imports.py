import os

smart_dir = "c:/Users/localhost/Documents/Enrollpro/client/src/features/smart"

for root, dirs, files in os.walk(smart_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace react-router-dom with react-router
            if 'react-router-dom' in content:
                print(f"Replacing react-router-dom in {file}")
                content = content.replace('react-router-dom', 'react-router')
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)

print("Done replacing react-router-dom imports.")
