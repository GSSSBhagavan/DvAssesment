const fs = require('fs');
const path = './src/lib/assessment-data.json';

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const newQuestions = [
  {
    id: 6,
    type: "EMAIL_COMPOSE",
    category: "Email Correspondence & Professional Etiquette",
    question: "You are working on a project and you are facing a problem that you cannot solve. You already tried a few solutions.\n\nWrite an email to your senior developer asking for help.",
    assets: {
      imageDescription: null,
      codeSnippet: null,
      imageAsset: null,
      assetType: null
    },
    options: null,
    correctAnswer: null,
    explanation: "Tests problem explanation, help request, clarity, and professional tone.",
    responseConfig: {
      to: "Senior Developer",
      minWords: 20,
      maxWords: 250
    }
  },
  {
    id: 7,
    type: "EMAIL_COMPOSE",
    category: "Email Correspondence & Professional Etiquette",
    question: "You were expected to complete a task today, but an unexpected problem has delayed your work.\n\nWrite an email to your manager explaining the delay and giving an updated expected completion time.",
    assets: {
      imageDescription: null,
      codeSnippet: null,
      imageAsset: null,
      assetType: null
    },
    options: null,
    correctAnswer: null,
    explanation: "Tests accountability, delay explanation, updated timeline, and professionalism.",
    responseConfig: {
      to: "Manager",
      minWords: 20,
      maxWords: 250
    }
  },
  {
    id: 8,
    type: "EMAIL_COMPOSE",
    category: "Email Correspondence & Professional Etiquette",
    question: "You need to discuss an important project issue with your manager.\n\nWrite an email requesting a short meeting and briefly explain why you would like to discuss the issue.",
    assets: {
      imageDescription: null,
      codeSnippet: null,
      imageAsset: null,
      assetType: null
    },
    options: null,
    correctAnswer: null,
    explanation: "Tests meeting request, clarity, purpose, and professional tone.",
    responseConfig: {
      to: "Manager",
      minWords: 20,
      maxWords: 250
    }
  },
  {
    id: 9,
    type: "EMAIL_COMPOSE",
    category: "Email Correspondence & Professional Etiquette",
    question: "A client is waiting for an important project update. The work is progressing, but it is taking slightly longer than expected.\n\nWrite a professional email to the client explaining the current status and when they can expect the next update.",
    assets: {
      imageDescription: null,
      codeSnippet: null,
      imageAsset: null,
      assetType: null
    },
    options: null,
    correctAnswer: null,
    explanation: "Tests client communication, clarity, empathy, expectation management, and professionalism.",
    responseConfig: {
      to: "Client",
      minWords: 20,
      maxWords: 250
    }
  },
  {
    id: 10,
    type: "EMAIL_COMPOSE",
    category: "Email Correspondence & Professional Etiquette",
    question: "You sent a report to your manager, but you later noticed that one important detail was incorrect.\n\nWrite an email informing your manager about the mistake, apologizing professionally, and explaining what you will do to correct it.",
    assets: {
      imageDescription: null,
      codeSnippet: null,
      imageAsset: null,
      assetType: null
    },
    options: null,
    correctAnswer: null,
    explanation: "Tests ownership, apology, problem explanation, corrective action, and professionalism.",
    responseConfig: {
      to: "Manager",
      minWords: 20,
      maxWords: 250
    }
  }
];

// Reconstruct the array
const newData = [];
for (let q of data) {
  if (q.id >= 6 && q.id <= 10) {
    const newQ = newQuestions.find(x => x.id === q.id);
    if (newQ) newData.push(newQ);
  } else {
    newData.push(q);
  }
}

fs.writeFileSync(path, JSON.stringify(newData, null, 2));
console.log('Updated Q06-Q10.');
