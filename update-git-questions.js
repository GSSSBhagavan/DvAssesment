const fs = require('fs');
const path = 'src/lib/assessment-data.json';
let data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Filter out 31 to 35
data = data.filter(q => !(q.id >= 31 && q.id <= 35));

const gitQuestions = {
  21: { type: 'GIT_COMMAND', question: "Type the Git command used to check the current working tree status.", scenario: "You have modified some files in your project and want to check which files have changed." },
  22: { type: 'GIT_COMMAND', question: "Type the Git command to stage app.py.", scenario: "You created a new file called app.py and want to stage it before committing." },
  23: { type: 'GIT_COMMAND', question: "Type the Git command to create this commit.", scenario: "You have staged your changes and want to create a commit with the message \"Add login feature\"." },
  24: { type: 'GIT_COMMAND', question: "Type the Git command used to view the commit history.", scenario: "You want to see the commit history of your repository." },
  25: { type: 'GIT_COMMAND', question: "Type the Git command to push your current branch to origin.", scenario: "Your local branch is ready and you want to send your commits to the remote repository named origin." },
  
  26: { type: 'MULTIPLE_CHOICE', question: "Which Git command moves changes from the working directory to the staging area?", scenario: "Review the Git workflow diagram below.", image: "/git-workflow.svg", options: ["git push", "git commit", "git add", "git log"] },
  27: { type: 'MULTIPLE_CHOICE', question: "Looking at the diagram, why would a developer use the feature-login branch?", scenario: "Review the branch diagram below.", image: "/git-branch.svg", options: ["To develop the login feature separately", "To delete the main branch", "To remove all previous commits", "To automatically publish the application"] },
  28: { type: 'MULTIPLE_CHOICE', question: "What is happening in the Git diagram?", scenario: "Review the diagram below showing two branches.", image: "/git-merge.svg", options: ["A repository is being cloned", "Changes from one branch are being combined into another branch", "All commits are being deleted", "A new remote repository is being created"] },
  29: { type: 'MULTIPLE_CHOICE', question: "What does 'modified: app.py' mean in this situation?", scenario: "Review the terminal output below.", image: "/git-status.svg", options: ["app.py has been deleted", "app.py has changes that are not currently staged", "app.py has already been pushed to GitHub", "app.py does not exist"] },
  30: { type: 'MULTIPLE_CHOICE', question: "What is the purpose of git push in this workflow?", scenario: "Review the interaction between local and remote repositories.", image: "/git-push.svg", options: ["Download changes from the remote repository", "Send local commits to the remote repository", "Delete the local repository", "Create a new Git branch automatically"] }
};

for (const q of data) {
  if (gitQuestions[q.id]) {
    const upd = gitQuestions[q.id];
    q.type = upd.type;
    q.question = upd.question;
    q.passage = upd.scenario; // use passage for scenario text
    q.category = "GitHub & Version Control";
    
    if (upd.type === 'MULTIPLE_CHOICE') {
      q.options = upd.options;
      q.image = upd.image;
    }
  }
}

// Re-sort data by id
data.sort((a, b) => a.id - b.id);

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Updated Q21-Q30 and removed Q31-Q35, length is now', data.length);
