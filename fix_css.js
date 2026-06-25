const fs = require('fs');
let css = fs.readFileSync('app/globals.css', 'utf8');
css = css.replace(/@tailwind base;\s*@tailwind components;\s*@tailwind utilities;/g, '@import "tailwindcss";\n@source "../components";');
fs.writeFileSync('app/globals.css', css, 'utf8');
console.log('Fixed globals.css');
