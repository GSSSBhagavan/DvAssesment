const fs = require('fs');
const path = 'src/lib/assessment-data.json';
let data = JSON.parse(fs.readFileSync(path, 'utf8'));

// We want exactly 65 questions in sequential order.
// Let's create a map of existing questions to preserve Q1-Q30.
const existing = {};
data.forEach(q => { existing[q.id] = q; });

const newData = [];

// Q1-Q30: Keep as is.
for (let i = 1; i <= 30; i++) {
  if (existing[i]) {
    newData.push(existing[i]);
  } else {
    // Just in case, dummy data (should not happen for 1-30)
    newData.push({ id: i, type: 'FREE_TEXT', category: 'Dummy', question: 'Missing' });
  }
}

// Q31-Q50: New Code Snapshots & Output Analysis
const section4Data = [
  { id: 31, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What will this code print?', img: '/q31-js.svg', opts: ['15', '105', '5', 'Error'] },
  { id: 32, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What will the Python program print?', img: '/q32-py.svg', opts: ['2', '3', '4', 'Error'] },
  { id: 33, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What will be printed?', img: '/q33-cond.svg', opts: ['Minor', 'Adult', 'True', 'Error'] },
  { id: 34, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What value will be printed?', img: '/q34-arr.svg', opts: ['A', 'B', 'C', 'undefined'] },
  { id: 35, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What does the CSS primarily change?', img: '/q35-css.svg', opts: ['Database connection', 'Button appearance', 'API response', 'Server memory'] },
  
  { id: 36, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What does this React component return?', img: '/q36-react.svg', opts: ['A database query', 'An HTML heading rendered through JSX', 'A REST API response', 'A Node.js server'] },
  { id: 37, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What happens when the button is clicked?', img: '/q37-state.svg', opts: ['The server restarts', 'The count state increases by 1', 'The database is deleted', 'The browser closes'] },
  { id: 38, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What is this frontend code primarily doing?', img: '/q38-fetch.svg', opts: ['Calling an API and processing the response', 'Creating a database table', 'Deploying the application', 'Compiling Python code'] },
  { id: 39, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What is the primary purpose of this request?', img: '/q39-post.svg', opts: ['Retrieve an existing user', 'Create/send new user data', 'Delete the server', 'Download a CSS file'] },
  { id: 40, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What does HTTP 200 generally indicate?', img: '/q40-200.svg', opts: ['Authentication failed', 'Request was successfully processed', 'Server crashed', 'Resource was permanently deleted'] },
  
  { id: 41, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What is this backend route designed to do?', img: '/q41-express.svg', opts: ['Return users from the database', 'Render CSS', 'Create a Git branch', 'Deploy the application'] },
  { id: 42, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What is the most likely meaning of this response?', img: '/q42-401.svg', opts: ['The request was successful', 'Authentication/authorization credentials are missing or invalid', 'The database table does not exist', 'The frontend CSS has a syntax error'] },
  { id: 43, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What does this query do?', img: '/q43-sql1.svg', opts: ['Deletes user 10', 'Retrieves name and email for user 10', 'Creates a new user', 'Updates all users'] },
  { id: 44, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What operation does this SQL statement perform?', img: '/q44-sql2.svg', opts: ['SELECT', 'DELETE', 'INSERT', 'UPDATE'] },
  { id: 45, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'How is this data primarily represented?', img: '/q45-mongo.svg', opts: ['Relational row only', 'Document-style data', 'CSS object', 'HTTP header'] },
  
  { id: 46, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'Why is the backend commonly placed between the frontend and database?', img: '/q46-arch.svg', opts: ['To handle business logic and control database access', 'To replace HTML', 'To increase monitor resolution', 'To remove the need for authentication'] },
  { id: 47, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What is a common purpose of Vercel in this architecture?', img: '/q47-vercel.svg', opts: ['Hosting/deploying the web application', 'Designing database schemas', 'Writing Python automatically', 'Replacing Git'] },
  { id: 48, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'In this architecture, what is the Render service most likely responsible for?', img: '/q48-render.svg', opts: ['Running the backend/API service', 'Editing images', 'Managing browser bookmarks', 'Replacing the frontend'] },
  { id: 49, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'What is the main role of Netlify in this architecture?', img: '/q49-netlify.svg', opts: ['Hosting/deploying the frontend application', 'Acting as the database', 'Executing SQL queries directly from the browser', 'Replacing the backend API'] },
  { id: 50, cat: 'Code Snapshots & Output Analysis', type: 'MULTIPLE_CHOICE', q: 'A production web application is deployed using this architecture. Which statement best describes the design?', img: '/q50-prod.svg', opts: ['The browser directly controls the database', 'The frontend communicates with a backend API, which handles application logic and database access', 'Vercel is being used as the database', "Render is replacing the user's browser"] }
];

section4Data.forEach(q => {
  newData.push({
    id: q.id,
    type: q.type,
    category: q.cat,
    question: q.q,
    image: q.img,
    options: q.opts
  });
});

// Q51-Q65: The remaining 15 questions. Let's grab the remaining questions from the old data that aren't 1-30.
// We'll rename their category to "Core Technical & Architecture" or whatever they were, and assign IDs 51-65 sequentially.
let remainder = data.filter(q => q.id > 50 || (q.id > 30 && q.id <= 50 && q.category !== 'Code Snapshots & Output Analysis'));
// Let's just collect exactly 15 arbitrary questions from the old set to fill 51-65, or generate dummy if missing.
const pool = data.filter(q => !newData.find(n => n.id === q.id) && q.id > 30);
for (let i = 51; i <= 65; i++) {
  let pulled = pool.shift();
  if (pulled) {
    pulled.id = i;
    pulled.category = 'Core Technical & Architecture';
    newData.push(pulled);
  } else {
    newData.push({ id: i, type: 'FREE_TEXT', category: 'Core Technical & Architecture', question: 'Placeholder ' + i });
  }
}

fs.writeFileSync(path, JSON.stringify(newData, null, 2));
console.log('Restructured assessment-data.json. Total questions:', newData.length);
