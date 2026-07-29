const fs = require('fs');

const path = 'app/(app)/vault/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const toRemove = new Set([14, 19, 21, 22, 46, 47, 138, 139]);

for(let i = 24; i <= 28; i++) toRemove.add(i);
for(let i = 30; i <= 43; i++) toRemove.add(i);
for(let i = 176; i <= 185; i++) toRemove.add(i);
for(let i = 1009; i <= 1265; i++) toRemove.add(i);
for(let i = 2013; i <= 2169; i++) toRemove.add(i);

const newLines = lines.filter((_, idx) => !toRemove.has(idx + 1));

fs.writeFileSync(path, newLines.join('\n'), 'utf8');

console.log(`Removed ${toRemove.size} lines. Original: ${lines.length}, New: ${newLines.length}`);
