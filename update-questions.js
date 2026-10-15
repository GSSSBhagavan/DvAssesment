const fs = require('fs');
const path = 'src/lib/assessment-data.json';
let data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Find and replace Q9
const q9Index = data.findIndex(q => q.id === 9);
if (q9Index !== -1) {
  data[q9Index] = {
    id: 9,
    type: "MULTIPLE_CHOICE",
    category: "Email Correspondence & Professional Etiquette",
    question: "Which response would be the most professional?",
    assets: {
      imageAsset: "/q09-email.svg",
      assetType: "EMAIL_SCREENSHOT"
    },
    options: [
      "The project is delayed. You will have to wait.",
      "Hi Sarah, thank you for following up. The project is progressing, and we are currently completing the remaining work. We expect to share the next update tomorrow.",
      "Why are you asking again? We already told you.",
      "Wait until the project is finished. We cannot provide updates."
    ],
    correctAnswer: "Hi Sarah, thank you for following up. The project is progressing, and we are currently completing the remaining work. We expect to share the next update tomorrow.",
    explanation: "A professional response acknowledges the client, provides a high-level update, and sets a clear expectation for the next update."
  };
}

// Find and replace Q10
const q10Index = data.findIndex(q => q.id === 10);
if (q10Index !== -1) {
  data[q10Index] = {
    id: 10,
    type: "MULTIPLE_CHOICE",
    category: "Email Correspondence & Professional Etiquette",
    question: "What is the most professional way to handle this situation?",
    assets: {
      imageAsset: "/q10-email.svg",
      assetType: "EMAIL_SCREENSHOT"
    },
    options: [
      "Ignore the mistake unless the manager notices it.",
      "Delete the original email and say nothing.",
      "Inform the manager about the mistake, apologize briefly, and send the corrected information.",
      "Blame another team member for the incorrect information."
    ],
    correctAnswer: "Inform the manager about the mistake, apologize briefly, and send the corrected information.",
    explanation: "Owning up to mistakes promptly, apologizing briefly, and providing the correction is the standard professional approach."
  };
}

// Section 02 - Q11 to Q20
const section02Replacements = {
  11: {
    question: "You are joining a new development team. Which introduction is the most professional?",
    options: [
      "Hi. I'm new here. I don't know much, so please tell me everything.",
      "Hi everyone, I'm Alex. I'm joining the team as a Software Engineer. I have experience with Python and web development, and I'm looking forward to learning from the team and contributing to the project.",
      "Hi. I am the best developer here and I expect everyone to help me.",
      "Hello. I don't think introductions are necessary."
    ],
    correctAnswer: "Hi everyone, I'm Alex. I'm joining the team as a Software Engineer. I have experience with Python and web development, and I'm looking forward to learning from the team and contributing to the project."
  },
  12: {
    question: "What is the most professional way to ask a senior developer for help?",
    options: [
      "This doesn't work. Fix it for me.",
      "I tried several approaches and checked the documentation, but the issue is still unresolved. Could you please help me review what I might be missing?",
      "I couldn't solve it, so I stopped working on it.",
      "The API is broken. It's not my problem."
    ],
    correctAnswer: "I tried several approaches and checked the documentation, but the issue is still unresolved. Could you please help me review what I might be missing?"
  },
  13: {
    question: "Which update would be the most professional?",
    options: [
      "It's almost done.",
      "Dashboard integration is 80% complete. The frontend and API connection are finished. Testing remains, and I expect to complete it by tomorrow.",
      "Everything is done.",
      "I'm working on it. I'll tell you later."
    ],
    correctAnswer: "Dashboard integration is 80% complete. The frontend and API connection are finished. Testing remains, and I expect to complete it by tomorrow."
  },
  14: {
    question: "Which response is the most professional?",
    options: [
      "It's not our fault.",
      "You will need to wait.",
      "Thank you for your patience. The update has taken longer than expected. We are completing the remaining work and will provide the next update by tomorrow.",
      "We already told you the project is delayed."
    ],
    correctAnswer: "Thank you for your patience. The update has taken longer than expected. We are completing the remaining work and will provide the next update by tomorrow."
  },
  15: {
    question: "What should you communicate to your manager?",
    options: [
      "Someone else caused the delay.",
      "The task is delayed because the required data is still pending. I have completed the available work and expect to finish the remaining part once the data is available.",
      "I don't know what happened.",
      "I will ignore the deadline."
    ],
    correctAnswer: "The task is delayed because the required data is still pending. I have completed the available work and expect to finish the remaining part once the data is available."
  },
  16: {
    question: "What would be the most professional response?",
    options: [
      "Not ready. Wait.",
      "Hi Sarah, thank you for checking in. The dashboard is still in progress, and we expect to share the updated version tomorrow.",
      "We are busy with other work.",
      "You should ask someone else."
    ],
    correctAnswer: "Hi Sarah, thank you for checking in. The dashboard is still in progress, and we expect to share the updated version tomorrow."
  },
  17: {
    question: "What is the best way to ask a senior developer for help?",
    options: [
      "I can't do this. Please finish it.",
      "I tried several approaches and checked the documentation, but I'm still seeing the unexpected response. Could you help me review the issue?",
      "This API is useless.",
      "I didn't try anything. Can you solve it?"
    ],
    correctAnswer: "I tried several approaches and checked the documentation, but I'm still seeing the unexpected response. Could you help me review the issue?"
  },
  18: {
    question: "Which message should be sent to the manager?",
    options: [
      "The task is delayed because nobody gave me the data.",
      "The data is missing. I don't know what to do.",
      "The data required for the import is still pending, so the task may be delayed. I have completed the available work and will finish the remaining work as soon as the data is available.",
      "I'll just mark the task complete."
    ],
    correctAnswer: "The data required for the import is still pending, so the task may be delayed. I have completed the available work and will finish the remaining work as soon as the data is available."
  },
  19: {
    question: "What is the most professional way to handle the disagreement?",
    options: [
      "Choose whichever developer is more senior.",
      "Stop discussing it and choose randomly.",
      "Compare both approaches against the project requirements, technical evidence, and trade-offs, then agree on the most suitable solution.",
      "Let the disagreement continue until someone gives up."
    ],
    correctAnswer: "Compare both approaches against the project requirements, technical evidence, and trade-offs, then agree on the most suitable solution."
  },
  20: {
    question: "Which response demonstrates the most professional attitude?",
    options: [
      "I don't agree. My work is good enough.",
      "That's not my responsibility.",
      "Thank you for the feedback. I understand that my progress updates need to be clearer and more timely. I'll work on improving this going forward.",
      "Other team members also give late updates."
    ],
    correctAnswer: "Thank you for the feedback. I understand that my progress updates need to be clearer and more timely. I'll work on improving this going forward."
  }
};

for (let id = 11; id <= 20; id++) {
  const index = data.findIndex(q => q.id === id);
  if (index !== -1 && section02Replacements[id]) {
    data[index] = {
      id: id,
      type: "MULTIPLE_CHOICE",
      category: "Workplace Communication",
      question: section02Replacements[id].question,
      assets: {
        imageAsset: "/q" + id + "-scenario.svg",
        assetType: "EMAIL_SCREENSHOT"
      },
      options: section02Replacements[id].options,
      correctAnswer: section02Replacements[id].correctAnswer,
      explanation: "Professional communication prioritizes clarity, respect, and constructive solutions."
    };
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Successfully updated assessment-data.json for Q09-Q20.');
