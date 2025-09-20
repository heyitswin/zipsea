#!/usr/bin/env python3
import os
import re

print("Fixing Redis connection issues in all services...")

# Define files to fix and their specific changes
files_to_fix = [
    {
        'path': 'src/services/webhook-processor-optimized-v2.service.ts',
        'add_import': True,
        'import_after': "import * as crypto from 'crypto';",
        'replacements': [
            ("const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';",
             "const redisUrl = env.REDIS_URL || 'redis://localhost:6379';"),
            ("host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',",
             "host: env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',"),
            ("user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,",
             "user: env.TRAVELTEK_FTP_USER,"),
            ("password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,",
             "password: env.TRAVELTEK_FTP_PASSWORD,"),
        ]
    },
    {
        'path': 'src/services/redis-maintenance.service.ts',
        'add_import': True,
        'import_at_top': True,
        'replacements': [
            ('process.env.REDIS_URL', 'env.REDIS_URL'),
        ]
    },
    {
        'path': 'src/services/webhook-processor-optimized.service.ts',
        'add_import': True,
        'import_after': 'import ',
        'replacements': [
            ('process.env.REDIS_URL', 'env.REDIS_URL'),
        ]
    },
    {
        'path': 'src/services/webhook-processor-fixed.service.ts',
        'add_import': True,
        'import_after': 'import ',
        'replacements': [
            ('process.env.REDIS_URL', 'env.REDIS_URL'),
        ]
    },
    {
        'path': 'src/services/webhook-processor-robust.service.ts',
        'add_import': True,
        'import_after': 'import ',
        'replacements': [
            ('process.env.REDIS_URL', 'env.REDIS_URL'),
        ]
    },
]

for file_info in files_to_fix:
    file_path = file_info['path']
    full_path = os.path.join(os.path.dirname(__file__), file_path)

    if not os.path.exists(full_path):
        print(f"⚠️  File not found: {file_path}")
        continue

    with open(full_path, 'r') as f:
        content = f.read()

    # Check if import already exists
    if "import { env } from '../config/environment'" not in content:
        if file_info.get('add_import'):
            if file_info.get('import_at_top'):
                # Add at the very beginning of the file
                content = "import { env } from '../config/environment';\n" + content
            elif 'import_after' in file_info:
                # Add after a specific import
                import_line = file_info['import_after']
                if import_line in content:
                    # Find the end of the line containing the import
                    idx = content.find(import_line)
                    if idx != -1:
                        # Find the next newline
                        newline_idx = content.find('\n', idx)
                        if newline_idx != -1:
                            content = (content[:newline_idx + 1] +
                                      "import { env } from '../config/environment';\n" +
                                      content[newline_idx + 1:])

    # Apply replacements
    for old_text, new_text in file_info['replacements']:
        content = content.replace(old_text, new_text)

    # Write the file back
    with open(full_path, 'w') as f:
        f.write(content)

    print(f"✅ Fixed {file_path}")

print("\n✅ All files fixed!")
print("\nNext steps:")
print("1. Build: cd backend && npm run build")
print("2. Commit: git add -A && git commit -m 'Fix Redis connection - use env module'")
print("3. Push to production: git push origin production")
