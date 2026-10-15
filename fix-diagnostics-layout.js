const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

// Container width
code = code.replace(
  'className="max-w-3xl w-full max-h-[90vh] bg-white border border-slate-200/80 rounded-[24px] shadow-2xl z-10 overflow-hidden flex flex-col"',
  'className="max-w-5xl w-full max-h-[90vh] bg-white border border-slate-200/80 rounded-[24px] shadow-2xl z-10 overflow-hidden flex flex-col"'
);

// Grid layout for checks
code = code.replace(
  'className="space-y-4 mb-10"',
  'className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10"'
);

fs.writeFileSync('src/app/page.tsx', code);
console.log('Fixed Diagnostics Layout');
