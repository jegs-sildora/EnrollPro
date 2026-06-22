import re

ROUTER_PATH = r'c:\Users\localhost\Documents\Enrollpro\client\src\router\index.tsx'

with open(ROUTER_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('path: "/bosy",', 'path: "/continuing-learners",')

with open(ROUTER_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("Router updated.")
