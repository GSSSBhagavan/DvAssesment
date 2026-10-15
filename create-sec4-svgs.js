const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');

function makeCodeSvg(codeStr) {
  const lines = codeStr.split('\\n');
  const height = Math.max(200, lines.length * 24 + 100);
  let svg = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 \${height}" width="100%" height="100%">
    <rect width="100%" height="100%" fill="#F8FAFC" />
    <rect x="50" y="50" width="700" height="\${height - 100}" rx="12" fill="#0F172A" />
    <!-- Window controls -->
    <circle cx="80" cy="80" r="6" fill="#EF4444"/>
    <circle cx="100" cy="80" r="6" fill="#F59E0B"/>
    <circle cx="120" cy="80" r="6" fill="#10B981"/>
    <g font-family="monospace" font-size="16" fill="#E2E8F0">
\`;
  lines.forEach((l, i) => {
    // Basic syntax highlighting for generic presentation
    let lineContent = l
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    svg += \`      <text x="80" y="\${130 + (i * 24)}" xml:space="preserve">\${lineContent}</text>\\n\`;
  });
  svg += \`    </g>\\n</svg>\`;
  return svg;
}

const codes = {
  31: "const x = 10;\\nconst y = 5;\\n\\nconsole.log(x + y);",
  32: "numbers = [1, 2, 3]\\nprint(len(numbers))",
  33: "age = 20\\n\\nif age >= 18:\\n    print(\"Adult\")\\nelse:\\n    print(\"Minor\")",
  34: "const users = [\"A\", \"B\", \"C\"];\\nconsole.log(users[1]);",
  35: "<button class=\"primary\">Login</button>\\n\\n.primary {\\n  background: black;\\n  color: white;\\n}",
  36: "function Welcome() {\\n  return <h1>Hello User</h1>;\\n}",
  37: "const [count, setCount] = useState(0);\\n\\n<button onClick={() => setCount(count + 1)}>\\n  {count}\\n</button>",
  38: "fetch(\"/api/users\")\\n  .then(res => res.json())\\n  .then(data => console.log(data));",
  39: "POST /api/users\\n\\n{\\n  \"name\": \"Rahul\",\\n  \"email\": \"rahul@example.com\"\\n}",
  40: "GET /api/products\\n\\nHTTP/1.1 200 OK\\n\\n[\\n  {\\n    \"id\": 1,\\n    \"name\": \"Laptop\"\\n  }\\n]",
  41: "app.get(\"/api/users\", async (req, res) => {\\n  const users = await User.find();\\n  res.json(users);\\n});",
  42: "Frontend:\\nGET /api/profile\\n\\nResponse:\\n401 Unauthorized",
  43: "SELECT name, email\\nFROM users\\nWHERE id = 10;",
  44: "INSERT INTO users (name, email)\\nVALUES ('Alex', 'alex@example.com');",
  45: "{\\n  \"_id\": \"123\",\\n  \"name\": \"Alex\",\\n  \"skills\": [\"Python\", \"React\"]\\n}"
};

for (const [id, code] of Object.entries(codes)) {
  fs.writeFileSync(path.join(publicDir, \`q\${id}-something.svg\`.replace('-something', (id <= 35 ? (id==31?'js':id==32?'py':id==33?'cond':id==34?'arr':'css') : (id==36?'react':id==37?'state':id==38?'fetch':id==39?'post':id==40?'200':id==41?'express':id==42?'401':id==43?'sql1':id==44?'sql2':'mongo')))), makeCodeSvg(code));
}

// Generate Diagrams
const q46Arch = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <g font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle">
    <rect x="300" y="50" width="200" height="60" rx="8" fill="#DBEAFE" stroke="#3B82F6" stroke-width="3"/>
    <text x="400" y="85" fill="#1D4ED8" font-size="16">React Frontend</text>
    <path d="M 400 110 L 400 150" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="300" y="160" width="200" height="60" rx="8" fill="#D1FAE5" stroke="#10B981" stroke-width="3"/>
    <text x="400" y="195" fill="#047857" font-size="16">REST API / Backend</text>
    <path d="M 400 220 L 400 260" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="300" y="270" width="200" height="60" rx="8" fill="#FEF3C7" stroke="#F59E0B" stroke-width="3"/>
    <text x="400" y="305" fill="#B45309" font-size="16">Database</text>
  </g>
  <defs><marker id="arr" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#94A3B8"/></marker></defs>
</svg>\`;

const q47Vercel = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <g font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle">
    <rect x="300" y="50" width="200" height="60" rx="8" fill="#F1F5F9" stroke="#475569" stroke-width="3"/>
    <text x="400" y="85" fill="#334155" font-size="16">GitHub Repository</text>
    <path d="M 400 110 L 400 150" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="300" y="160" width="200" height="60" rx="8" fill="#000" stroke="#000" stroke-width="3"/>
    <text x="400" y="195" fill="#FFF" font-size="20">▲ Vercel</text>
    <path d="M 400 220 L 400 260" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="300" y="270" width="200" height="60" rx="8" fill="#D1FAE5" stroke="#10B981" stroke-width="3"/>
    <text x="400" y="305" fill="#047857" font-size="16">Production URL</text>
  </g>
  <defs><marker id="arr" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#94A3B8"/></marker></defs>
</svg>\`;

const q48Render = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <g font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle">
    <rect x="300" y="30" width="200" height="60" rx="8" fill="#DBEAFE" stroke="#3B82F6" stroke-width="3"/>
    <text x="400" y="65" fill="#1D4ED8" font-size="16">React Frontend</text>
    <path d="M 400 90 L 400 150" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    <text x="480" y="125" fill="#64748B" font-size="14">API Request</text>

    <rect x="300" y="160" width="200" height="60" rx="8" fill="#E0E7FF" stroke="#4F46E5" stroke-width="3"/>
    <text x="400" y="195" fill="#3730A3" font-size="16">Render Backend</text>
    <path d="M 400 220 L 400 280" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="250" y="290" width="300" height="60" rx="8" fill="#FEF3C7" stroke="#F59E0B" stroke-width="3"/>
    <text x="400" y="325" fill="#B45309" font-size="16">PostgreSQL / MongoDB</text>
  </g>
  <defs><marker id="arr" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#94A3B8"/></marker></defs>
</svg>\`;

const q49Netlify = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <g font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle">
    <rect x="300" y="20" width="200" height="50" rx="8" fill="#F1F5F9" stroke="#475569" stroke-width="3"/>
    <text x="400" y="50" fill="#334155" font-size="14">User Browser</text>
    <path d="M 400 70 L 400 110" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="300" y="120" width="200" height="50" rx="8" fill="#CCFBF1" stroke="#14B8A6" stroke-width="3"/>
    <text x="400" y="150" fill="#0F766E" font-size="16">Netlify</text>
    <path d="M 400 170 L 400 210" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="300" y="220" width="200" height="50" rx="8" fill="#DBEAFE" stroke="#3B82F6" stroke-width="3"/>
    <text x="400" y="250" fill="#1D4ED8" font-size="14">React Frontend</text>
    <path d="M 400 270 L 400 310" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="300" y="320" width="200" height="50" rx="8" fill="#D1FAE5" stroke="#10B981" stroke-width="3"/>
    <text x="400" y="350" fill="#047857" font-size="14">Backend API</text>
    <path d="M 400 370 L 400 410" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="300" y="420" width="200" height="50" rx="8" fill="#FEF3C7" stroke="#F59E0B" stroke-width="3"/>
    <text x="400" y="450" fill="#B45309" font-size="14">Database</text>
  </g>
  <defs><marker id="arr" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#94A3B8"/></marker></defs>
</svg>\`;

const q50Prod = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <g font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle">
    <text x="400" y="40" fill="#334155" font-size="16">USERS</text>
    <path d="M 400 50 L 400 90" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="250" y="100" width="300" height="50" rx="8" fill="#DBEAFE" stroke="#3B82F6" stroke-width="3"/>
    <text x="400" y="130" fill="#1D4ED8" font-size="16">FRONTEND / VERCEL</text>
    <path d="M 400 150 L 400 210" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    <text x="460" y="185" fill="#64748B" font-size="12">HTTPS / API</text>

    <rect x="250" y="220" width="300" height="50" rx="8" fill="#E0E7FF" stroke="#4F46E5" stroke-width="3"/>
    <text x="400" y="250" fill="#3730A3" font-size="16">BACKEND / RENDER</text>

    <!-- Branching Arrows -->
    <path d="M 400 270 L 400 300" fill="none" stroke="#94A3B8" stroke-width="3"/>
    <path d="M 250 300 L 550 300" fill="none" stroke="#94A3B8" stroke-width="3"/>
    <path d="M 250 300 L 250 330" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    <path d="M 550 300 L 550 330" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <rect x="150" y="340" width="200" height="70" rx="8" fill="#FEF3C7" stroke="#F59E0B" stroke-width="3"/>
    <text x="250" y="370" fill="#B45309" font-size="14">DATABASE</text>
    <text x="250" y="390" fill="#B45309" font-size="12">PostgreSQL / MongoDB</text>

    <rect x="450" y="340" width="200" height="70" rx="8" fill="#D1FAE5" stroke="#10B981" stroke-width="3"/>
    <text x="550" y="380" fill="#047857" font-size="14">EXTERNAL API</text>
  </g>
  <defs><marker id="arr" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#94A3B8"/></marker></defs>
</svg>\`;

fs.writeFileSync(path.join(publicDir, 'q46-arch.svg'), q46Arch);
fs.writeFileSync(path.join(publicDir, 'q47-vercel.svg'), q47Vercel);
fs.writeFileSync(path.join(publicDir, 'q48-render.svg'), q48Render);
fs.writeFileSync(path.join(publicDir, 'q49-netlify.svg'), q49Netlify);
fs.writeFileSync(path.join(publicDir, 'q50-prod.svg'), q50Prod);

console.log('Created 20 SVGs');
