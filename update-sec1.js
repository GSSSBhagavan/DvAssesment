const fs = require('fs');
const path = './src/lib/assessment-data.json';

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const newQuestions = [
  {
    "id": 1,
    "type": "MULTIPLE_CHOICE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "Which subject line is the most professional?",
    "assets": {
      "imageAsset": "/q01-email.svg",
      "assetType": "EMAIL_SCREENSHOT"
    },
    "options": [
      "Hi",
      "Important!!!",
      "Project Dashboard — Task Completed",
      "Please Read This ASAP"
    ],
    "correctAnswer": "Project Dashboard — Task Completed",
    "explanation": "A professional subject line should be clear and concise."
  },
  {
    "id": 2,
    "type": "MULTIPLE_CHOICE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "Which reply is the most professional?",
    "assets": {
      "imageAsset": "/q02-email.svg",
      "assetType": "EMAIL_SCREENSHOT"
    },
    "options": [
      "We are busy. Please wait.",
      "Will update later.",
      "Hello Sarah, thank you for following up. The project is progressing and we will share the updated status by tomorrow.",
      "You should have waited."
    ],
    "correctAnswer": "Hello Sarah, thank you for following up. The project is progressing and we will share the updated status by tomorrow.",
    "explanation": "Providing a polite and concrete update manages client expectations."
  },
  {
    "id": 3,
    "type": "MULTIPLE_CHOICE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "What is the best practice before sending this email?",
    "assets": {
      "imageAsset": "/q03-email.svg",
      "assetType": "EMAIL_SCREENSHOT"
    },
    "options": [
      "Send it without checking the attachment",
      "Verify that the correct file is attached and the email content is clear",
      "Add many unnecessary recipients",
      "Leave the subject empty"
    ],
    "correctAnswer": "Verify that the correct file is attached and the email content is clear",
    "explanation": "Always verify attachments before hitting send."
  },
  {
    "id": 4,
    "type": "MULTIPLE_CHOICE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "Why might the team lead be included in CC?",
    "assets": {
      "imageAsset": "/q04-email.svg",
      "assetType": "EMAIL_SCREENSHOT"
    },
    "options": [
      "To secretly send the email",
      "To keep the team lead informed",
      "To hide the message from the manager",
      "To replace the subject line"
    ],
    "correctAnswer": "To keep the team lead informed",
    "explanation": "CC (Carbon Copy) is used to keep stakeholders in the loop."
  },
  {
    "id": 5,
    "type": "MULTIPLE_CHOICE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "Which response demonstrates the most professional communication?",
    "assets": {
      "imageAsset": "/q05-email.svg",
      "assetType": "EMAIL_SCREENSHOT"
    },
    "options": [
      "Blame another team immediately",
      "Ignore the delay until the deadline passes",
      "Explain the situation clearly and provide an updated timeline",
      "Simply write 'It is delayed.'"
    ],
    "correctAnswer": "Explain the situation clearly and provide an updated timeline",
    "explanation": "Professionalism requires accountability and clear communication regarding delays."
  },
  {
    "id": 6,
    "type": "MULTIPLE_CHOICE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "Which follow-up approach is most professional?",
    "assets": {
      "imageAsset": "/q06-email.svg",
      "assetType": "EMAIL_SCREENSHOT"
    },
    "options": [
      "Send multiple messages every few minutes",
      "Politely follow up and briefly mention the original request",
      "Write an angry message",
      "Contact everyone in the company"
    ],
    "correctAnswer": "Politely follow up and briefly mention the original request",
    "explanation": "A polite follow-up is the best way to get a response."
  },
  {
    "id": 7,
    "type": "MULTIPLE_CHOICE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "What is the main problem with this email?",
    "assets": {
      "imageAsset": "/q07-email.svg",
      "assetType": "EMAIL_SCREENSHOT"
    },
    "options": [
      "It is too professional",
      "It uses an unnecessarily aggressive and unprofessional tone",
      "It has too much technical information",
      "It contains a useful deadline"
    ],
    "correctAnswer": "It uses an unnecessarily aggressive and unprofessional tone",
    "explanation": "All caps and aggressive language are highly unprofessional."
  },
  {
    "id": 8,
    "type": "MULTIPLE_CHOICE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "Which email demonstrates better professional communication?",
    "assets": {
      "imageAsset": "/q08-email.svg",
      "assetType": "EMAIL_SCREENSHOT"
    },
    "options": [
      "Email A",
      "Email B",
      "Both are equally clear",
      "Neither contains a subject"
    ],
    "correctAnswer": "Email B",
    "explanation": "Email B is polite, clear, and sets correct expectations."
  },
  {
    "id": 9,
    "type": "EMAIL_COMPOSE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "A client is waiting for an important project update. The project is progressing, but it is taking slightly longer than expected.\n\nWrite a professional email to the client explaining the current project status and when they can expect the next update.",
    "responseConfig": {
      "to": "Client",
      "minWords": 10,
      "maxWords": 300
    }
  },
  {
    "id": 10,
    "type": "EMAIL_COMPOSE",
    "category": "Email Correspondence & Professional Etiquette",
    "question": "You sent a project report to your manager and later discovered that one important detail in the report was incorrect.\n\nWrite a professional email to your manager informing them about the mistake, apologizing briefly, and explaining that the report has been corrected.",
    "responseConfig": {
      "to": "Manager",
      "minWords": 10,
      "maxWords": 300
    }
  }
];

const newData = [];
for (let i = 0; i < data.length; i++) {
  const q = data[i];
  if (q.id >= 1 && q.id <= 10) {
    const newQ = newQuestions.find(x => x.id === q.id);
    if (newQ) newData.push(newQ);
  } else {
    newData.push(q);
  }
}

fs.writeFileSync(path, JSON.stringify(newData, null, 2));
console.log('Updated Q01-Q10.');
