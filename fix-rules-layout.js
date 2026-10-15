const fs = require('fs');

let code = fs.readFileSync('src/app/page.tsx', 'utf8');

// Update RULES container max width
code = code.replace(
  'className="max-w-2xl w-full bg-white border border-slate-200/80 rounded-[24px] p-10 md:p-14 shadow-2xl z-10"',
  'className="max-w-4xl w-full bg-white border border-slate-200/80 rounded-[24px] p-10 md:p-14 shadow-2xl z-10"'
);

// Update RULES internal layout from vertical stack to a 3-column grid
code = code.replace(
  '<div className="space-y-4 mb-10">',
  '<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">'
);

// Update individual rule cards to flex-col
const oldRuleCard = 'className="flex gap-5 items-start p-6 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors"';
const newRuleCard = 'className="flex flex-col gap-4 items-start p-6 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors h-full"';

// There are exactly 3 rule cards
code = code.replaceAll(oldRuleCard, newRuleCard);

fs.writeFileSync('src/app/page.tsx', code);
console.log('Fixed Rules Layout');
