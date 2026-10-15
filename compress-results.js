const fs = require('fs');

const path = 'src/app/results/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// Container padding & gap
code = code.replace(
  'main className="flex-1 max-w-[900px] w-full mx-auto px-6 py-12 flex flex-col gap-8"',
  'main className="flex-1 max-w-[900px] w-full mx-auto px-6 py-6 flex flex-col gap-4"'
);

// Hero Section
code = code.replace(
  'className="text-center bg-white border border-slate-200 rounded-3xl p-12 shadow-sm relative overflow-hidden"',
  'className="text-center bg-white border border-slate-200 rounded-[20px] p-6 shadow-sm relative overflow-hidden"'
);
code = code.replace(
  'className="flex justify-center mb-6"',
  'className="flex justify-center mb-4"'
);
code = code.replace(
  'className="w-16 h-16 rounded-full border-2 border-emerald-500 flex items-center justify-center relative z-10 bg-white"',
  'className="w-12 h-12 rounded-full border-2 border-emerald-500 flex items-center justify-center relative z-10 bg-white"'
);
code = code.replace(
  'className="text-3xl font-bold text-slate-900 tracking-tight mb-3"',
  'className="text-2xl font-bold text-slate-900 tracking-tight mb-2"'
);
code = code.replace(
  'className="text-slate-500 text-lg max-w-lg mx-auto mb-8"',
  'className="text-slate-500 text-[15px] max-w-lg mx-auto mb-4"'
);
code = code.replace(
  '<Check size={24} className="text-emerald-500 stroke-[3]" />',
  '<Check size={20} className="text-emerald-500 stroke-[3]" />'
);

// Status timeline
code = code.replace(
  'className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm overflow-hidden"',
  'className="bg-white border border-slate-200 rounded-[16px] p-5 shadow-sm overflow-hidden"'
);

// Submission Summary
code = code.replace(
  'className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6"',
  'className="bg-white border border-slate-200 rounded-[16px] p-5 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4"'
);

// Bottom Grids
code = code.replace(
  'className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12"',
  'className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"'
);
code = code.replace(
  'className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col"',
  'className="bg-white border border-slate-200 rounded-[16px] p-6 shadow-sm flex flex-col"'
);
code = code.replace(
  'className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col"',
  'className="bg-white border border-slate-200 rounded-[16px] p-6 shadow-sm flex flex-col"'
);
code = code.replace(
  'className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6"',
  'className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4"'
);
code = code.replace(
  'className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6"',
  'className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4"'
);
code = code.replace(
  'className="mb-6"',
  'className="mb-4"'
);
// replace multiple occurrences of mb-6
code = code.replaceAll('mb-6', 'mb-4');

// Action Area
code = code.replace(
  'className="flex justify-center"',
  'className="flex justify-center mt-2"'
);
code = code.replace(
  'px-8 py-4',
  'px-6 py-3'
);

fs.writeFileSync(path, code);
console.log('Fixed results page layout compression');
