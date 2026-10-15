const fs = require('fs');
const path = 'src/components/assessment/QuestionRenderer.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `  const renderWorkspace = () => {
    if (question.category.includes('Email')) {
      if (question.type === 'EMAIL_COMPOSE') {
        return <EmailComposeWorkspace question={question} />;
      }
      return <EmailWorkspace question={question} />;
    }
    if (question.category.includes('Communication')) {
      if (question.type === 'FREE_TEXT') {
        return <PassageWorkspace question={question} />;
      }
      return <VoiceWorkspace question={question} />;
    }`,
  `  const renderWorkspace = () => {
    if (question.category.includes('Email')) {
      if (question.type === 'EMAIL_COMPOSE') {
        return <EmailComposeWorkspace question={question} />;
      }
      return <EmailWorkspace question={question} />;
    }
    if (question.category.includes('Communication')) {
      if (question.type === 'MULTIPLE_CHOICE') {
        return <EmailWorkspace question={question} />;
      }
      if (question.type === 'FREE_TEXT') {
        return <PassageWorkspace question={question} />;
      }
      return <VoiceWorkspace question={question} />;
    }`
);

fs.writeFileSync(path, code);
console.log('Fixed QuestionRenderer');
