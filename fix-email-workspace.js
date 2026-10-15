const fs = require('fs');
const path = 'src/components/workspaces/EmailWorkspace.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'const isSelected = selected === opt;',
  'const isSelected = selected === labels[i];'
);

code = code.replace(
  'onClick={() => setAnswer(question.id, opt)}',
  'onClick={() => setAnswer(question.id, labels[i])}'
);

fs.writeFileSync(path, code);
console.log('Fixed EmailWorkspace to save letters instead of full strings');
