const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

// Remove max-h-[90vh] from the card
code = code.replace(
  'className="max-w-5xl w-full max-h-[90vh] bg-white border border-slate-200/80 rounded-[24px] shadow-2xl z-10 overflow-hidden flex flex-col"',
  'className="max-w-5xl w-full bg-white border border-slate-200/80 rounded-[24px] shadow-2xl z-10 overflow-hidden flex flex-col"'
);

// Reduce header padding
code = code.replace(
  'className="p-8 md:p-12 pb-6 relative overflow-hidden bg-slate-900"',
  'className="p-6 md:p-8 relative overflow-hidden bg-slate-900"'
);

// Reduce content padding and REMOVE overflow-y-auto so there is no internal scrollbar
code = code.replace(
  'className="p-8 md:p-12 bg-white flex-1 overflow-y-auto custom-scrollbar"',
  'className="p-6 md:p-8 bg-white flex-1"'
);

// Reduce bottom section padding
code = code.replace(
  'className="mt-auto border-t border-slate-100 pt-8"',
  'className="mt-auto border-t border-slate-100 pt-6"'
);

// The grid has mb-10. Reduce it to mb-6
code = code.replace(
  'className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10"',
  'className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"'
);

// Remove scrollbar from LandingPage wrapper just in case, wait no, let the wrapper scroll if screen is extremely tiny.
// The wrapper is: <div className="flex-1 overflow-y-auto bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6 font-sans min-h-screen relative overflow-x-hidden">
// This is correct.

fs.writeFileSync('src/app/page.tsx', code);
console.log('Fixed Diagnostics Scrollbar and Paddings');
