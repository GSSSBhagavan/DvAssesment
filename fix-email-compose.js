const fs = require('fs');
const file = 'src/components/workspaces/EmailComposeWorkspace.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/\/\/ Real-time local state to global state debounce[\s\S]*?\}, \[subject, body, question\.id, setAnswer, answers\]\);/m, 
`// Real-time local state to global state debounce
  useEffect(() => {
    const currentGlobal = parseAnswer(answers[question.id]);
    
    if (subject !== currentGlobal.subject || body !== currentGlobal.body) {
      setSaveState('SAVING');
      
      const hasContent = subject.trim().length > 0 && body.trim().length > 0;
      
      if (hasContent) {
        setAnswer(question.id, JSON.stringify({ subject, body }));
      } else if (!subject.trim() && !body.trim()) {
        setAnswer(question.id, '');
      } else {
        setAnswer(question.id, JSON.stringify({ subject, body }));
      }

      const t = setTimeout(() => {
        setSaveState('SAVED');
      }, 400);

      return () => clearTimeout(t);
    }
  }, [subject, body, question.id, setAnswer, answers]);`);

fs.writeFileSync(file, code);
console.log('Fixed EmailComposeWorkspace');
