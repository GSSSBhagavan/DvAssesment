const fs = require('fs');
const path = 'src/components/assessment/AssessmentSidebar.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const isEmailAnalysis = questionObj?.type === 'MULTIPLE_CHOICE' && questionObj?.category?.includes('Email');",
  "const isEmailAnalysis = false;"
);

fs.writeFileSync(path, code);
console.log('Fixed Sidebar Icons');
