const fs = require('fs');
const path = 'src/components/workspaces/EmailWorkspace.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replaceAll('\\`', '`');
code = code.replaceAll('\\$', '$');

fs.writeFileSync(path, code);
console.log('Fixed backslashes in EmailWorkspace.tsx');
