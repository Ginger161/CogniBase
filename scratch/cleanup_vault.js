const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/(app)/vault/page.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Remove VaultChatMessage
content = content.replace(/export type VaultChatMessage = \{[^}]+\};\n/g, '');

// 2. Remove states
content = content.replace(/  const \[isConsoleOpen, setIsConsoleOpen\] = useState\(false\);\n/g, '');
content = content.replace(/  const \[currentChatId, setCurrentChatId\] = useState<string \| null>\(null\);\n/g, '');
content = content.replace(/  const \[chatList, setChatList\] = useState<Array<\{ id: string, title: string, updatedAt: any \}>>\(\[\]\);\n/g, '');
content = content.replace(/  \/\/ Console state\n/g, '');
content = content.replace(/  const \[messages, setMessages\] = useState<VaultChatMessage\[\]>\(\[\{ role: 'ai', content: 'Acknowledged\. I am >_console\. Ask me anything about your uploaded materials\.' \}\]\);\n/g, '');
content = content.replace(/  const \[consoleInput, setConsoleInput\] = useState\(''\);\n/g, '');
content = content.replace(/  const \[isQuerying, setIsQuerying\] = useState\(false\);\n/g, '');
content = content.replace(/  const \[thinkingStatus, setThinkingStatus\] = useState\('Locating course notes in Vault\.\.\.'\);\n/g, '');

// 3. Remove useEffect for isQuerying
content = content.replace(/  useEffect\(\(\) => \{\n    let interval: NodeJS\.Timeout;\n    if \(isQuerying\) \{[\s\S]*?  \}, \[isQuerying\]\);\n/g, '');

// 4. Remove editingMessageIndex and editInput
content = content.replace(/  const \[editingMessageIndex, setEditingMessageIndex\] = useState<number \| null>\(null\);\n/g, '');
content = content.replace(/  const \[editInput, setEditInput\] = useState\(""\);\n/g, '');

// 5. Remove chat resets in UID check
content = content.replace(/      setChatList\(\[\]\);\n      setCurrentChatId\(null\);\n/g, '');

// 6. Remove chat fetching logic
const chatFetchRegex = /      \/\/ Fetch Chat List\n      try \{\n        const q = query\(collection\(db, 'chats'\), where\('userId', '==', context\.uid\)\);[\s\S]*?      \} catch \(error\) \{\n        console\.error\("Error fetching chats:", error\);\n      \}\n/g;
content = content.replace(chatFetchRegex, '');

// 7. Remove all chat handling functions (from useEffect depending on currentChatId to handleFeedback)
const handlersRegex = /  useEffect\(\(\) => \{\n    const loadChatHistory = async \(\) => \{[\s\S]*?  const handleFeedback = async \(index: number, type: 'up' \| 'down'\) => \{[\s\S]*?    setMessages\(newMessages\);\n[\s\S]*?      \}\)\;\n    \}\n  \};\n/g;
content = content.replace(handlersRegex, '');

// 8. Remove JSX `<aside className="console-panel"...>` block
const asideRegex = /        <aside className=\{`console-panel \$\{isConsoleOpen \? 'open' : ''\}`\}>[\s\S]*?<\/aside>\n/g;
content = content.replace(asideRegex, '');

// 9. Check if anything is missed (like the toggle button)
content = content.replace(/        {!\(isConsoleOpen[\s\S]*?setIsConsoleOpen\(true\)[\s\S]*?<\/button>\n      \)}/g, '');

fs.writeFileSync(targetPath, content);
console.log('Cleanup script executed.');
