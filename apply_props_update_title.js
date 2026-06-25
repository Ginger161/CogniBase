const fs = require('fs');
const path = 'c:/Users/HENRY/Documents/cognibase/app/(app)/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<CommandCenterUI([\s\S]*?)onSendMessage=\{([\s\S]*?)\}\s*\/>/g;

const newCall = `<CommandCenterUI$1onSendMessage={$2}
                onUpdateTitle={setActiveWorkspaceName}
              />`;

content = content.replace(regex, newCall);
fs.writeFileSync(path, content, 'utf8');
console.log("Updated page.tsx with onUpdateTitle prop");
