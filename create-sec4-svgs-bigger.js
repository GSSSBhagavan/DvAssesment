const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');

function makeCodeSvg(codeStr) {
  const lines = codeStr.split('\n');
  const innerH = 80 + lines.length * 36;
  const height = innerH + 100;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" width="100%" height="100%">
    <rect width="100%" height="100%" fill="#FFFFFF" />
    <rect x="20" y="50" width="760" height="${innerH}" rx="12" fill="#0F172A" />
    <circle cx="50" cy="80" r="8" fill="#EF4444"/>
    <circle cx="75" cy="80" r="8" fill="#F59E0B"/>
    <circle cx="100" cy="80" r="8" fill="#10B981"/>
    <g font-family="monospace, Consolas, 'Courier New'" font-size="28" font-weight="500" fill="#E2E8F0">
`;
  lines.forEach((l, i) => {
    let lineContent = l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    svg += `      <text x="50" y="${140 + (i * 36)}" xml:space="preserve">${lineContent}</text>\n`;
  });
  svg += `    </g>\n</svg>`;
  return svg;
}

const codes = {
  31: "const x = 10;\nconst y = 5;\n\nconsole.log(x + y);",
  32: "numbers = [1, 2, 3]\nprint(len(numbers))",
  33: "age = 20\n\nif age >= 18:\n    print(\"Adult\")\nelse:\n    print(\"Minor\")",
  34: "const users = [\"A\", \"B\", \"C\"];\nconsole.log(users[1]);",
  35: "<button class=\"primary\">Login</button>\n\n.primary {\n  background: black;\n  color: white;\n}",
  36: "function Welcome() {\n  return <h1>Hello User</h1>;\n}",
  37: "const [count, setCount] = useState(0);\n\n<button onClick={() => setCount(count + 1)}>\n  {count}\n</button>",
  38: "fetch(\"/api/users\")\n  .then(res => res.json())\n  .then(data => console.log(data));",
  39: "POST /api/users\n\n{\n  \"name\": \"Rahul\",\n  \"email\": \"rahul@example.com\"\n}",
  40: "GET /api/products\n\nHTTP/1.1 200 OK\n\n[\n  {\n    \"id\": 1,\n    \"name\": \"Laptop\"\n  }\n]",
  41: "app.get(\"/api/users\", async (req, res) => {\n  const users = await User.find();\n  res.json(users);\n});",
  42: "Frontend:\nGET /api/profile\n\nResponse:\n401 Unauthorized",
  43: "SELECT name, email\nFROM users\nWHERE id = 10;",
  44: "INSERT INTO users (name, email)\nVALUES ('Alex', 'alex@example.com');",
  45: "{\n  \"_id\": \"123\",\n  \"name\": \"Alex\",\n  \"skills\": [\"Python\", \"React\"]\n}"
};

for (const [id, code] of Object.entries(codes)) {
  const name = id <= 35 ? (id==31?'js':id==32?'py':id==33?'cond':id==34?'arr':'css') : (id==36?'react':id==37?'state':id==38?'fetch':id==39?'post':id==40?'200':id==41?'express':id==42?'401':id==43?'sql1':id==44?'sql2':'mongo');
  fs.writeFileSync(path.join(publicDir, `q${id}-${name}.svg`), makeCodeSvg(code));
}

console.log('Bigger SVGs generated');
