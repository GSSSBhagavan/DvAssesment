const fs = require('fs');
const path = require('path');

const dataPath = path.join(process.cwd(), 'src/lib/assessment-data.json');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// 1. Generate Safe Data Module
const safeData = rawData.map(q => {
  const safeQ = { ...q };
  delete safeQ.correctAnswer;
  delete safeQ.explanation;
  return safeQ;
});

const safeDataFile = path.join(process.cwd(), 'src/lib/safe-questions.ts');
fs.writeFileSync(safeDataFile, `export const assessmentData = ${JSON.stringify(safeData, null, 2)};\nexport default assessmentData;\n`);

// 2. Generate Server-Only Keys Module
const keysData = rawData.map(q => {
  return {
    id: q.id,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation
  };
});

const serverKeysFile = path.join(process.cwd(), 'src/server/assessment-keys.ts');
fs.writeFileSync(serverKeysFile, `import 'server-only';\n\nexport const answerKeys = ${JSON.stringify(keysData, null, 2)};\n`);

// 3. Update all imports
const filesToUpdate = [
  'src/app/results/page.tsx',
  'src/components/assessment/AssessmentHeader.tsx',
  'src/components/assessment/AssessmentShell.tsx',
  'src/components/assessment/AssessmentSidebar.tsx',
  'src/components/assessment/QuestionRenderer.tsx',
  'src/components/assessment/SubmitConfirmationModal.tsx',
  'src/components/review/ReviewPanel.tsx',
  'src/components/workspaces/EmailWorkspace.tsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/import assessmentData from '@\/lib\/assessment-data\.json';/g, `import assessmentData from '@/lib/safe-questions';`);
  fs.writeFileSync(filePath, content, 'utf-8');
});

console.log('Refactoring complete.');
