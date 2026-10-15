const fs = require('fs');
const path = require('path');
const p = 'src/lib/assessment-data.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

// Filter out 51+
const newData = data.filter(q => q.id <= 50);

const sec5 = [
  { id: 51, q: "What number should come next?", img: "/q51-number.svg", opts: ["20", "24", "32", "36"] },
  { id: 52, q: "Which shape should come next?", img: "/q52-shape.svg", opts: ["Circle", "Triangle", "Square", "Rectangle"] },
  { id: 53, q: "On which day were the most tasks completed?", img: "/q53-chart.svg", opts: ["Monday", "Tuesday", "Wednesday", "Thursday"] },
  { id: 54, q: "If there are 15 frontend tasks, how many backend tasks would maintain the same ratio?", img: "/q54-ratio.svg", opts: ["5", "8", "10", "12"] },
  { id: 55, q: "If the three tasks are completed one after another, how much total time is required?", img: "/q55-time.svg", opts: ["4 hours", "5 hours", "6 hours", "7 hours"] },
  { id: 56, q: "If one item is selected randomly, what is the probability of selecting a red item?", img: "/q56-prob.svg", opts: ["2/5", "3/5", "1/2", "1/3"] },
  { id: 57, q: "Which team has the largest number of developers?", img: "/q57-teams.svg", opts: ["Team A", "Team B", "Team C", "All teams are equal"] },
  { id: 58, q: "If lower response time is preferred, which server currently performs best?", img: "/q58-server.svg", opts: ["Server A", "Server B", "Server C", "All are equal"] },
  { id: 59, q: "Based only on the information shown, what can you conclude?", img: "/q59-decision.svg", opts: ["The response time improved", "The database was deleted", "The application stopped working", "The number of users became zero"] },
  { id: 60, q: "Why might the second architecture be preferred when the number of users increases significantly?", img: "/q60-system.svg", opts: ["It can distribute traffic across multiple servers", "It removes the need for users", "It eliminates all databases", "It makes the application require no network"] }
];

sec5.forEach(q => {
  newData.push({
    id: q.id,
    type: "MULTIPLE_CHOICE",
    category: "Technical Aptitude & Engineering Reasoning",
    question: q.q,
    image: q.img,
    options: q.opts
  });
});

fs.writeFileSync(p, JSON.stringify(newData, null, 2));
console.log('Saved', newData.length, 'questions');
