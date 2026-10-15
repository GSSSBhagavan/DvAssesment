const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

code = code.replace(
  'relative overflow-hidden',
  'relative overflow-x-hidden'
);

code = code.replace(
  'className="max-w-3xl w-full bg-white border border-slate-200/80 rounded-[24px] shadow-2xl z-10 overflow-hidden flex flex-col"',
  'className="max-w-3xl w-full max-h-[90vh] bg-white border border-slate-200/80 rounded-[24px] shadow-2xl z-10 overflow-hidden flex flex-col"'
);

code = code.replace(
  'className="p-8 md:p-12 bg-white flex-1"',
  'className="p-8 md:p-12 bg-white flex-1 overflow-y-auto custom-scrollbar"'
);

fs.writeFileSync('src/app/page.tsx', code);
console.log('Fixed page.tsx scroll');
