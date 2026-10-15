const fs = require('fs');
const path = './src/lib/assessment-data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Update Q11-15 (Voice) and Q16-20 (Free Text)
const questionsToUpdate = {
  11: { type: 'VOICE_RESPONSE', question: "You are meeting your new team for the first time.\nIntroduce yourself and tell them a little about your skills.", passage: "Instruction: Speak for about 30 seconds." },
  12: { type: 'VOICE_RESPONSE', question: "You are working on a task, but you are stuck.\nYou already tried to solve the problem.\nAsk your senior developer for help.", passage: "Instruction: Speak as if you are talking to your senior." },
  13: { type: 'VOICE_RESPONSE', question: "Your manager asks:\n'How is your work going?'\nYou finished most of your task, but one small part is still pending.", passage: "Instruction: Give your manager a short update." },
  14: { type: 'VOICE_RESPONSE', question: "A client is unhappy because their work is delayed.\nThey ask:\n'Why is this taking so long?'", passage: "Instruction: Respond to the client politely." },
  15: { type: 'VOICE_RESPONSE', question: "You promised your manager that you would finish a task today.\nYou now realize that you need more time.", passage: "Instruction: Tell your manager about the delay." },
  
  16: { type: 'FREE_TEXT', question: "What would be the most professional reply to this client?", passage: "A client has contacted your team because they were expecting an updated project dashboard today. The dashboard is not ready yet. Your team is still working on it and expects to complete it soon. The client wants to know when they can expect the updated version." },
  17: { type: 'FREE_TEXT', question: "How would you professionally ask your senior developer for help?", passage: "You are working on a development task and have already tried several possible solutions. The issue is still not resolved. You now need help from a senior developer." },
  18: { type: 'FREE_TEXT', question: "What would you tell your manager about the delayed task?", passage: "You are responsible for completing a project task today. However, some required data has not been provided yet, so the task cannot be completed on time. Your manager needs to know about the delay and the updated expected completion time." },
  19: { type: 'FREE_TEXT', question: "How would you professionally handle this situation?", passage: "Two developers on your team have different opinions about how to implement an important feature. The discussion is becoming unproductive, and both developers believe their approach is better." },
  20: { type: 'FREE_TEXT', question: "How would you professionally respond to this feedback?", passage: "Your manager tells you that the technical quality of your work is good, but your progress updates are sometimes unclear or too late. The manager expects you to communicate project progress more effectively." }
};

for (const q of data) {
  if (questionsToUpdate[q.id]) {
    q.type = questionsToUpdate[q.id].type;
    q.question = questionsToUpdate[q.id].question;
    q.passage = questionsToUpdate[q.id].passage;
    // ensure responseConfig is ok
    if (q.type === 'FREE_TEXT') {
       q.responseConfig = { maxCharacters: 500 };
    }
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Updated Q11-Q20 in assessment-data.json');
