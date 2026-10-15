const fs = require('fs');
const path = './src/lib/assessment-data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const gitFixes = {
  21: {
    question: "You have modified some files in your project. Type the Git command used to check the current working tree status.",
    correctAnswer: "git status",
    explanation: "git status shows the state of the working directory and the staging area."
  },
  22: {
    question: "You created a new file called app.py. Type the Git command to stage app.py.",
    correctAnswer: "git add app.py",
    explanation: "git add stages files for the next commit."
  },
  23: {
    question: "You have staged your changes and want to create a commit with the message \"Add login feature\". Type the Git command to create this commit.",
    correctAnswer: "git commit -m \"Add login feature\"",
    explanation: "git commit -m allows you to create a commit with an inline message."
  },
  24: {
    question: "Type the Git command used to view the commit history.",
    correctAnswer: "git log",
    explanation: "git log shows the commit history for the current repository."
  },
  25: {
    question: "Your local branch is ready. Type the Git command to push your current branch to origin.",
    correctAnswer: "git push origin",
    explanation: "git push origin uploads your local branch commits to the remote repository named origin."
  }
};

for (let i = 0; i < data.length; i++) {
  if (gitFixes[data[i].id]) {
    data[i].question = gitFixes[data[i].id].question;
    data[i].correctAnswer = gitFixes[data[i].id].correctAnswer;
    data[i].explanation = gitFixes[data[i].id].explanation;
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Fixed Git questions.');
