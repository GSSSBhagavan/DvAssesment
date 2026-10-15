const fs = require('fs');
let c = fs.readFileSync('src/components/review/ReviewPanel.tsx', 'utf8');

const isAnsRepl = `let isAns = answers[q.id] !== undefined && answers[q.id] !== '';
                          const qDataAns = assessmentData.find(x => x.id === q.id);
                          if (isAns && qDataAns?.type === 'EMAIL_COMPOSE') {
                            try {
                              const parsed = JSON.parse(answers[q.id]);
                              isAns = !!(parsed.subject?.trim() && parsed.body?.trim());
                            } catch {
                              isAns = false;
                            }
                          }`;

c = c.replace(/const isAns = answers\[q\.id\] !== undefined;/g, isAnsRepl);
fs.writeFileSync('src/components/review/ReviewPanel.tsx', c);
console.log('Replaced all isAns');
