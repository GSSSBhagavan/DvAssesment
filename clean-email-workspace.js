const fs = require('fs');
const path = 'src/components/workspaces/EmailWorkspace.tsx';
let code = fs.readFileSync(path, 'utf8');

// Strip out FREE_TEXT completely
code = code.replace(
  /\{\s*question\.type === 'FREE_TEXT'[\s\S]*?<\/textarea>\s*<\/div>\s*\)\}/g,
  ''
);

// Strip out VOICE_RESPONSE completely
code = code.replace(
  /\{\s*question\.type === 'VOICE_RESPONSE'[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/g,
  ''
);

// Strip out leftover parts of VOICE_RESPONSE
code = code.replace(
  /\{\s*question\.type === 'VOICE_RESPONSE'[\s\S]*?<\/div>\s*\)\}/g,
  ''
);

// Fix the header text
code = code.replace(
  /question\.type === 'MULTIPLE_CHOICE' \? 'SELECT THE MOST PROFESSIONAL RESPONSE' :\s*question\.type === 'FREE_TEXT' \? 'TYPE YOUR RESPONSE' :\s*'VOICE RESPONSE'/g,
  "'SELECT THE MOST PROFESSIONAL RESPONSE'"
);

// Remove the `question.type === 'MULTIPLE_CHOICE' && (` wrapper because it's always MCQ now
code = code.replace(
  /\{\s*question\.type === 'MULTIPLE_CHOICE' && \(\s*<div/g,
  '<div'
);

// Close tag fix for the above wrapper removal
code = code.replace(
  /<\/div>\s*\)\}/g,
  '</div>'
);

fs.writeFileSync(path, code);
console.log('Stripped unused input types from EmailWorkspace');
