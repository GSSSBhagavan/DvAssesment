const fs = require('fs');

const file = 'src/components/assessment/QuestionRenderer.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /<div className="h-\[56px\] border-t border-slate-200 bg-white flex items-center justify-between px-8 shrink-0 z-10">/g,
  '<div className="h-[48px] border-t border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">'
);

fs.writeFileSync(file, code);
console.log('Fixed QuestionRenderer');
