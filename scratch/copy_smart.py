import os
import shutil
import re

src_dir = "c:/Users/localhost/Documents/Enrollpro/SMART/CapstoneFinal/src"
dest_dir = "c:/Users/localhost/Documents/Enrollpro/client/src/features/smart"

public_src = "c:/Users/localhost/Documents/Enrollpro/SMART/CapstoneFinal/public"
public_dest = "c:/Users/localhost/Documents/Enrollpro/client/public"

# 1. Clean destination directory if it exists
if os.path.exists(dest_dir):
    shutil.rmtree(dest_dir)
os.makedirs(dest_dir, exist_ok=True)

# 2. Copy src files recursively
for root, dirs, files in os.walk(src_dir):
    # Compute relative path to src_dir
    rel_path = os.path.relpath(root, src_dir)
    if rel_path == ".":
        current_dest_dir = dest_dir
    else:
        current_dest_dir = os.path.join(dest_dir, rel_path)
        os.makedirs(current_dest_dir, exist_ok=True)
    
    for file in files:
        src_file = os.path.join(root, file)
        dest_file = os.path.join(current_dest_dir, file)
        shutil.copy2(src_file, dest_file)
        
        # 3. If file is code/style, rewrite @/ imports
        if file.endswith(('.ts', '.tsx', '.css')):
            with open(dest_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace "@/..." with "@/features/smart/..."
            new_content = re.sub(r'([\'"])(@/)(.*?)([\'"])', r'\1@/features/smart/\3\4', content)
            
            with open(dest_file, 'w', encoding='utf-8') as f:
                f.write(new_content)

print("Successfully copied src files and rewrote @/ imports.")

# 4. Copy public files
for file in os.listdir(public_src):
    src_file = os.path.join(public_src, file)
    if os.path.isfile(src_file):
        shutil.copy2(src_file, os.path.join(public_dest, file))

print("Successfully copied public assets.")
