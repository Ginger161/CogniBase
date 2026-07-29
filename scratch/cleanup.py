import os

path = 'app/(app)/vault/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

to_remove = set()
to_remove.update([14, 19, 21, 22, 46, 47, 138, 139])
to_remove.update(range(24, 29))
to_remove.update(range(30, 44))
to_remove.update(range(176, 186))
to_remove.update(range(1009, 1266))
to_remove.update(range(2013, 2170))

new_lines = [l for i, l in enumerate(lines) if (i+1) not in to_remove]

with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print(f"Removed {len(to_remove)} lines. Original: {len(lines)}, New: {len(new_lines)}")
