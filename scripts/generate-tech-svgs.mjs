import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Creates a modern macOS-style dark code window SVG
 */
function makeCodeWindowSvg({ title, language, lines, width = 760 }) {
  const lineHeight = 28;
  const topBarHeight = 44;
  const paddingBottom = 28;
  const contentHeight = lines.length * lineHeight;
  const totalHeight = topBarHeight + contentHeight + paddingBottom;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="100%" height="100%">
  <rect width="100%" height="100%" rx="14" fill="#0F172A" />
  
  <!-- Window Header -->
  <rect width="100%" height="${topBarHeight}" rx="14" fill="#1E293B" />
  <rect y="${topBarHeight - 6}" width="100%" height="6" fill="#1E293B" />
  <line x1="0" y1="${topBarHeight}" x2="${width}" y2="${topBarHeight}" stroke="#334155" stroke-width="1" />
  
  <!-- Window Controls -->
  <circle cx="24" cy="22" r="6" fill="#EF4444" />
  <circle cx="44" cy="22" r="6" fill="#F59E0B" />
  <circle cx="64" cy="22" r="6" fill="#10B981" />
  
  <!-- Title / Language Badge -->
  <text x="${width / 2}" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#94A3B8" text-anchor="middle">${escapeXml(title)}</text>
  <rect x="${width - 80}" y="11" width="64" height="22" rx="6" fill="#0F172A" stroke="#334155" stroke-width="1" />
  <text x="${width - 48}" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#38BDF8" text-anchor="middle">${escapeXml(language)}</text>
  
  <!-- Code Content -->
  <g font-family="Consolas, Monaco, 'Fira Code', 'Courier New', monospace" font-size="15" xml:space="preserve">
`;

  lines.forEach((line, idx) => {
    const y = topBarHeight + 30 + (idx * lineHeight);
    // Line number
    svg += `    <text x="30" y="${y}" fill="#475569" text-anchor="end" font-size="13">${idx + 1}</text>\n`;
    
    // Line content with custom colored spans if provided as array of tokens, or plain line
    if (typeof line === 'string') {
      svg += `    <text x="52" y="${y}" fill="#E2E8F0">${escapeXml(line)}</text>\n`;
    } else if (Array.isArray(line)) {
      svg += `    <text x="52" y="${y}">`;
      line.forEach(token => {
        svg += `<tspan fill="${token.color || '#E2E8F0'}" font-weight="${token.bold ? '700' : '400'}">${escapeXml(token.text)}</tspan>`;
      });
      svg += `</text>\n`;
    }
  });

  svg += `  </g>\n</svg>`;
  return svg;
}

/**
 * Creates an Architectural / Network Flow Diagram SVG
 */
function makeDiagramSvg({ title, width = 760, height = 360, elements }) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <!-- Background -->
  <rect width="100%" height="100%" rx="14" fill="#0F172A" />
  
  <!-- Header -->
  <rect width="100%" height="44" rx="14" fill="#1E293B" />
  <rect y="38" width="100%" height="6" fill="#1E293B" />
  <line x1="0" y1="44" x2="${width}" y2="44" stroke="#334155" stroke-width="1" />
  <circle cx="24" cy="22" r="6" fill="#EF4444" />
  <circle cx="44" cy="22" r="6" fill="#F59E0B" />
  <circle cx="64" cy="22" r="6" fill="#10B981" />
  <text x="${width / 2}" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#94A3B8" text-anchor="middle">${escapeXml(title)}</text>
  
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 z" fill="#38BDF8" />
    </marker>
    <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 z" fill="#34D399" />
    </marker>
  </defs>

  ${elements}
</svg>`;
  return svg;
}

const assets = [
  // ==========================================
  // PYTHON PROGRAMMING (Q31 - Q35)
  // ==========================================
  {
    filename: 'q31-python-dict.svg',
    content: makeCodeWindowSvg({
      title: 'Python Dictionary Comprehension',
      language: 'PYTHON',
      lines: [
        [
          { text: 'scores = ', color: '#E2E8F0' },
          { text: '{"Alice": 85, "Bob": 62, "Charlie": 91, "Diana": 58}', color: '#FDE047' }
        ],
        '',
        [
          { text: 'passed = {', color: '#E2E8F0' },
          { text: 'k: v ', color: '#38BDF8' },
          { text: 'for ', color: '#C084FC', bold: true },
          { text: 'k, v ', color: '#E2E8F0' },
          { text: 'in ', color: '#C084FC', bold: true },
          { text: 'scores.items() ', color: '#E2E8F0' },
          { text: 'if ', color: '#C084FC', bold: true },
          { text: 'v >= 75}', color: '#F472B6' }
        ],
        '',
        [
          { text: 'print', color: '#4ADE80' },
          { text: '(len(passed), list(passed.keys())[0])', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q32-python-scope.svg',
    content: makeCodeWindowSvg({
      title: 'Python Function Scope & Default Arguments',
      language: 'PYTHON',
      lines: [
        [
          { text: 'def ', color: '#C084FC', bold: true },
          { text: 'append_val', color: '#60A5FA' },
          { text: '(val, target=[]):', color: '#E2E8F0' }
        ],
        [
          { text: '    target.append(val)', color: '#E2E8F0' }
        ],
        [
          { text: '    return ', color: '#C084FC', bold: true },
          { text: 'target', color: '#E2E8F0' }
        ],
        '',
        [
          { text: 'first = append_val(10)', color: '#94A3B8' }
        ],
        [
          { text: 'second = append_val(20)', color: '#38BDF8' }
        ],
        [
          { text: 'print', color: '#4ADE80' },
          { text: '(second)', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q33-python-slice.svg',
    content: makeCodeWindowSvg({
      title: 'Python Slicing & String Transformation',
      language: 'PYTHON',
      lines: [
        [
          { text: 'words = ["cloud", "data", "edge", "mesh"]', color: '#FDE047' }
        ],
        '',
        [
          { text: 'transformed = [', color: '#E2E8F0' },
          { text: 'w[-1].upper() ', color: '#38BDF8' },
          { text: 'for ', color: '#C084FC', bold: true },
          { text: 'w ', color: '#E2E8F0' },
          { text: 'in ', color: '#C084FC', bold: true },
          { text: 'words[::-1]', color: '#F472B6' },
          { text: ']', color: '#E2E8F0' }
        ],
        '',
        [
          { text: 'print', color: '#4ADE80' },
          { text: '("".join(transformed))', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q34-python-except.svg',
    content: makeCodeWindowSvg({
      title: 'Python Try-Except-Else-Finally Flow',
      language: 'PYTHON',
      lines: [
        [
          { text: 'result = []', color: '#E2E8F0' }
        ],
        [
          { text: 'try:', color: '#C084FC', bold: true }
        ],
        [
          { text: '    num = int("42")', color: '#E2E8F0' }
        ],
        [
          { text: '    result.append("parsed")', color: '#38BDF8' }
        ],
        [
          { text: 'except ', color: '#C084FC', bold: true },
          { text: 'ValueError:', color: '#EF4444' }
        ],
        [
          { text: '    result.append("error")', color: '#EF4444' }
        ],
        [
          { text: 'else:', color: '#C084FC', bold: true }
        ],
        [
          { text: '    result.append("success")', color: '#34D399' }
        ],
        [
          { text: 'finally:', color: '#C084FC', bold: true }
        ],
        [
          { text: '    result.append("done")', color: '#FDE047' }
        ],
        '',
        [
          { text: 'print', color: '#4ADE80' },
          { text: '("-".join(result))', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q35-python-oop.svg',
    content: makeCodeWindowSvg({
      title: 'Python Object-Oriented Inheritance & super()',
      language: 'PYTHON',
      lines: [
        [
          { text: 'class ', color: '#C084FC', bold: true },
          { text: 'Service:', color: '#60A5FA' }
        ],
        [
          { text: '    def __init__(self, name):', color: '#E2E8F0' }
        ],
        [
          { text: '        self.name = name', color: '#E2E8F0' }
        ],
        [
          { text: '    def status(self):', color: '#E2E8F0' }
        ],
        [
          { text: '        return f"{self.name}:online"', color: '#FDE047' }
        ],
        '',
        [
          { text: 'class ', color: '#C084FC', bold: true },
          { text: 'SecureService', color: '#60A5FA' },
          { text: '(Service):', color: '#E2E8F0' }
        ],
        [
          { text: '    def status(self):', color: '#E2E8F0' }
        ],
        [
          { text: '        base = super().status()', color: '#38BDF8' }
        ],
        [
          { text: '        return f"{base}:encrypted"', color: '#34D399' }
        ],
        '',
        [
          { text: 'svc = SecureService("AuthAPI")', color: '#E2E8F0' }
        ],
        [
          { text: 'print', color: '#4ADE80' },
          { text: '(svc.status())', color: '#E2E8F0' }
        ]
      ]
    })
  },

  // ==========================================
  // JAVA PROGRAMMING (Q36 - Q40)
  // ==========================================
  {
    filename: 'q36-java-string.svg',
    content: makeCodeWindowSvg({
      title: 'Java String Immutability & Reassignment',
      language: 'JAVA',
      lines: [
        [
          { text: 'public class ', color: '#C084FC', bold: true },
          { text: 'TestApp {', color: '#60A5FA' }
        ],
        [
          { text: '    public static void ', color: '#C084FC', bold: true },
          { text: 'main(String[] args) {', color: '#E2E8F0' }
        ],
        [
          { text: '        String s1 = ', color: '#E2E8F0' },
          { text: '"Data";', color: '#FDE047' }
        ],
        [
          { text: '        String s2 = s1.concat(', color: '#E2E8F0' },
          { text: '"Valley");', color: '#FDE047' }
        ],
        [
          { text: '        s1.concat(', color: '#E2E8F0' },
          { text: '"Platform");', color: '#FDE047' }
        ],
        '',
        [
          { text: '        System.out.println(s1 + " " + s2);', color: '#38BDF8' }
        ],
        [
          { text: '    }', color: '#E2E8F0' }
        ],
        [
          { text: '}', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q37-java-loop.svg',
    content: makeCodeWindowSvg({
      title: 'Java Loop Control & Array Accumulation',
      language: 'JAVA',
      lines: [
        [
          { text: 'public class ', color: '#C084FC', bold: true },
          { text: 'LoopDemo {', color: '#60A5FA' }
        ],
        [
          { text: '    public static void ', color: '#C084FC', bold: true },
          { text: 'main(String[] args) {', color: '#E2E8F0' }
        ],
        [
          { text: '        int[] nums = {2, 4, 6, 8, 10};', color: '#FDE047' }
        ],
        [
          { text: '        int sum = 0;', color: '#E2E8F0' }
        ],
        [
          { text: '        for (int i = 1; i < nums.length - 1; i += 2) {', color: '#C084FC', bold: true }
        ],
        [
          { text: '            sum += nums[i];', color: '#38BDF8' }
        ],
        [
          { text: '        }', color: '#C084FC', bold: true }
        ],
        [
          { text: '        System.out.println(sum);', color: '#34D399' }
        ],
        [
          { text: '    }', color: '#E2E8F0' }
        ],
        [
          { text: '}', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q38-java-dispatch.svg',
    content: makeCodeWindowSvg({
      title: 'Java Polymorphism & Dynamic Method Dispatch',
      language: 'JAVA',
      lines: [
        [
          { text: 'class ', color: '#C084FC', bold: true },
          { text: 'BaseProcessor {', color: '#60A5FA' }
        ],
        [
          { text: '    void process() { System.out.print("Base "); }', color: '#E2E8F0' }
        ],
        [
          { text: '}', color: '#E2E8F0' }
        ],
        '',
        [
          { text: 'class ', color: '#C084FC', bold: true },
          { text: 'FastProcessor ', color: '#60A5FA' },
          { text: 'extends BaseProcessor {', color: '#E2E8F0' }
        ],
        [
          { text: '    @Override', color: '#38BDF8' }
        ],
        [
          { text: '    void process() { System.out.print("Fast "); }', color: '#34D399' }
        ],
        [
          { text: '}', color: '#E2E8F0' }
        ],
        '',
        [
          { text: 'BaseProcessor bp = new FastProcessor();', color: '#FDE047' }
        ],
        [
          { text: 'bp.process();', color: '#38BDF8' }
        ]
      ]
    })
  },
  {
    filename: 'q39-java-finally.svg',
    content: makeCodeWindowSvg({
      title: 'Java Exception Control & Finally Return Precedence',
      language: 'JAVA',
      lines: [
        [
          { text: 'public static int ', color: '#C084FC', bold: true },
          { text: 'compute() {', color: '#60A5FA' }
        ],
        [
          { text: '    try {', color: '#C084FC', bold: true }
        ],
        [
          { text: '        int val = 10 / 2;', color: '#E2E8F0' }
        ],
        [
          { text: '        return val;', color: '#38BDF8' }
        ],
        [
          { text: '    } catch (ArithmeticException e) {', color: '#C084FC', bold: true }
        ],
        [
          { text: '        return -1;', color: '#EF4444' }
        ],
        [
          { text: '    } finally {', color: '#C084FC', bold: true }
        ],
        [
          { text: '        return 99;', color: '#FDE047', bold: true }
        ],
        [
          { text: '    }', color: '#C084FC', bold: true }
        ],
        [
          { text: '}', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q40-java-collection.svg',
    content: makeCodeWindowSvg({
      title: 'Java Collections: List vs HashSet Uniqueness',
      language: 'JAVA',
      lines: [
        [
          { text: 'import java.util.*;', color: '#94A3B8' }
        ],
        '',
        [
          { text: 'List<String> list = Arrays.asList(', color: '#E2E8F0' }
        ],
        [
          { text: '    "apple", "banana", "apple", "cherry"', color: '#FDE047' }
        ],
        [
          { text: ');', color: '#E2E8F0' }
        ],
        '',
        [
          { text: 'Set<String> unique = new HashSet<>(list);', color: '#38BDF8' }
        ],
        '',
        [
          { text: 'System.out.println(unique.size() + " " + list.size());', color: '#34D399' }
        ]
      ]
    })
  },

  // ==========================================
  // FRONTEND & BACKEND (Q41 - Q45)
  // ==========================================
  {
    filename: 'q41-js-event-loop.svg',
    content: makeCodeWindowSvg({
      title: 'JavaScript Event Loop: Synchronous, Microtask & Macrotask',
      language: 'JAVASCRIPT',
      lines: [
        [
          { text: 'console.log(1);', color: '#38BDF8' }
        ],
        '',
        [
          { text: 'setTimeout', color: '#F59E0B' },
          { text: '(() => {', color: '#E2E8F0' }
        ],
        [
          { text: '  console.log(2);', color: '#F59E0B' }
        ],
        [
          { text: '}, 0);', color: '#E2E8F0' }
        ],
        '',
        [
          { text: 'Promise.resolve().then', color: '#A855F7' },
          { text: '(() => {', color: '#E2E8F0' }
        ],
        [
          { text: '  console.log(3);', color: '#A855F7' }
        ],
        [
          { text: '});', color: '#E2E8F0' }
        ],
        '',
        [
          { text: 'console.log(4);', color: '#38BDF8' }
        ]
      ]
    })
  },
  {
    filename: 'q42-react-state.svg',
    content: makeCodeWindowSvg({
      title: 'React State Batching & Functional Updaters',
      language: 'REACT JSX',
      lines: [
        [
          { text: 'function ', color: '#C084FC', bold: true },
          { text: 'Counter() {', color: '#60A5FA' }
        ],
        [
          { text: '  const [count, setCount] = useState(0);', color: '#38BDF8' }
        ],
        '',
        [
          { text: '  const handleClick = () => {', color: '#E2E8F0' }
        ],
        [
          { text: '    setCount(count + 1);', color: '#94A3B8' }
        ],
        [
          { text: '    setCount(count + 1);', color: '#94A3B8' }
        ],
        [
          { text: '    setCount(prev => prev + 2);', color: '#34D399', bold: true }
        ],
        [
          { text: '  };', color: '#E2E8F0' }
        ],
        '',
        [
          { text: '  return <button onClick={handleClick}>{count}</button>;', color: '#FDE047' }
        ],
        [
          { text: '}', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q43-express-middleware.svg',
    content: makeCodeWindowSvg({
      title: 'Node.js / Express.js Middleware Pipeline Execution',
      language: 'EXPRESS.JS',
      lines: [
        [
          { text: 'const express = require("express");', color: '#94A3B8' }
        ],
        [
          { text: 'const app = express();', color: '#94A3B8' }
        ],
        '',
        [
          { text: 'app.use((req, res, next) => {', color: '#C084FC', bold: true }
        ],
        [
          { text: '  console.log("M1-Start");', color: '#38BDF8' }
        ],
        [
          { text: '  next();', color: '#F59E0B', bold: true }
        ],
        [
          { text: '  console.log("M1-End");', color: '#38BDF8' }
        ],
        [
          { text: '});', color: '#C084FC', bold: true }
        ],
        '',
        [
          { text: 'app.get("/data", (req, res) => {', color: '#34D399', bold: true }
        ],
        [
          { text: '  console.log("Handler");', color: '#34D399' }
        ],
        [
          { text: '  res.send("OK");', color: '#E2E8F0' }
        ],
        [
          { text: '});', color: '#34D399' }
        ]
      ]
    })
  },
  {
    filename: 'q44-http-validation.svg',
    content: makeCodeWindowSvg({
      title: 'REST API Request Payload Semantic Validation',
      language: 'HTTP/REST',
      lines: [
        [
          { text: 'POST /api/v1/candidates HTTP/1.1', color: '#38BDF8', bold: true }
        ],
        [
          { text: 'Host: api.datavalley.ai', color: '#94A3B8' }
        ],
        [
          { text: 'Content-Type: application/json', color: '#94A3B8' }
        ],
        '',
        [
          { text: '{', color: '#E2E8F0' }
        ],
        [
          { text: '  "fullName": "Jane Doe",', color: '#E2E8F0' }
        ],
        [
          { text: '  "graduationYear": ', color: '#E2E8F0' },
          { text: '"two-thousand-twenty-five"', color: '#EF4444' },
          { text: '  // Expected integer (2025)', color: '#F87171' }
        ],
        [
          { text: '}', color: '#E2E8F0' }
        ],
        '',
        [
          { text: 'HTTP/1.1 ', color: '#94A3B8' },
          { text: '[ ??? Status Code ??? ]', color: '#F59E0B', bold: true }
        ],
        [
          { text: '{"error": "Validation failed: graduationYear must be an integer"}', color: '#FDE047' }
        ]
      ]
    })
  },
  {
    filename: 'q45-cors-preflight.svg',
    content: makeDiagramSvg({
      title: 'Cross-Origin Resource Sharing (CORS) Preflight Protocol',
      height: 380,
      elements: `
    <!-- Browser Client Box -->
    <rect x="40" y="80" width="220" height="240" rx="10" fill="#1E293B" stroke="#475569" stroke-width="2" />
    <text x="150" y="112" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#F8FAFC" text-anchor="middle">Browser Client</text>
    <text x="150" y="134" font-family="monospace" font-size="11" fill="#38BDF8" text-anchor="middle">https://app.datavalley.ai</text>
    <rect x="55" y="160" width="190" height="60" rx="6" fill="#0F172A" />
    <text x="65" y="184" font-family="monospace" font-size="11" fill="#E2E8F0">fetch("/api/test", {</text>
    <text x="75" y="202" font-family="monospace" font-size="11" fill="#94A3B8">  headers: { "Auth": ... }</text>
    <text x="65" y="214" font-family="monospace" font-size="11" fill="#E2E8F0">})</text>

    <!-- Preflight Arrow -->
    <path d="M 270 140 L 480 140" fill="none" stroke="#38BDF8" stroke-width="2" marker-end="url(#arrow)" />
    <text x="375" y="130" font-family="monospace" font-size="11" font-weight="700" fill="#38BDF8" text-anchor="middle">1. [ ??? Preflight Method ??? ]</text>
    <text x="375" y="156" font-family="monospace" font-size="10" fill="#94A3B8" text-anchor="middle">Access-Control-Request-Method: POST</text>

    <!-- Response Arrow -->
    <path d="M 480 220 L 270 220" fill="none" stroke="#34D399" stroke-width="2" stroke-dasharray="4" marker-end="url(#arrow-green)" />
    <text x="375" y="210" font-family="monospace" font-size="11" font-weight="700" fill="#34D399" text-anchor="middle">2. 204 No Content</text>
    <text x="375" y="238" font-family="monospace" font-size="10" fill="#94A3B8" text-anchor="middle">Access-Control-Allow-Origin: *</text>

    <!-- Actual Request Arrow -->
    <path d="M 270 270 L 480 270" fill="none" stroke="#FDE047" stroke-width="2" marker-end="url(#arrow)" />
    <text x="375" y="264" font-family="monospace" font-size="11" font-weight="700" fill="#FDE047" text-anchor="middle">3. Actual POST /api/test</text>

    <!-- Target Server Box -->
    <rect x="500" y="80" width="220" height="240" rx="10" fill="#1E293B" stroke="#475569" stroke-width="2" />
    <text x="610" y="112" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#F8FAFC" text-anchor="middle">API Backend Server</text>
    <text x="610" y="134" font-family="monospace" font-size="11" fill="#34D399" text-anchor="middle">https://api.datavalley.ai</text>
    <rect x="515" y="160" width="190" height="130" rx="6" fill="#0F172A" />
    <text x="525" y="184" font-family="monospace" font-size="11" fill="#94A3B8">// CORS Middleware Check</text>
    <text x="525" y="206" font-family="monospace" font-size="11" fill="#38BDF8">originAllowed(origin)?</text>
    <text x="525" y="228" font-family="monospace" font-size="11" fill="#38BDF8">headersAllowed(headers)?</text>
    <text x="525" y="250" font-family="monospace" font-size="11" fill="#34D399">return headers;</text>
      `
    })
  },

  // ==========================================
  // DATABASE & DEPLOYMENT (Q46 - Q50)
  // ==========================================
  {
    filename: 'q46-sql-having.svg',
    content: makeCodeWindowSvg({
      title: 'SQL Aggregate Filtering on Grouped Records',
      language: 'SQL',
      lines: [
        [
          { text: 'SELECT ', color: '#C084FC', bold: true },
          { text: 'department, ', color: '#E2E8F0' },
          { text: 'COUNT', color: '#38BDF8' },
          { text: '(student_id) ', color: '#E2E8F0' },
          { text: 'AS ', color: '#C084FC', bold: true },
          { text: 'total_students', color: '#FDE047' }
        ],
        [
          { text: 'FROM ', color: '#C084FC', bold: true },
          { text: 'candidate_assessments', color: '#E2E8F0' }
        ],
        [
          { text: 'WHERE ', color: '#C084FC', bold: true },
          { text: 'status = ', color: '#E2E8F0' },
          { text: "'COMPLETED'", color: '#34D399' }
        ],
        [
          { text: 'GROUP BY ', color: '#C084FC', bold: true },
          { text: 'department', color: '#E2E8F0' }
        ],
        [
          { text: '[ ??? Clause ??? ] ', color: '#F59E0B', bold: true },
          { text: 'COUNT', color: '#38BDF8' },
          { text: '(student_id) > 3;', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q47-sql-leftjoin.svg',
    content: makeDiagramSvg({
      title: 'SQL Relational LEFT JOIN Unmatched Records',
      height: 380,
      elements: `
    <!-- Students Table -->
    <rect x="40" y="80" width="220" height="230" rx="8" fill="#1E293B" stroke="#38BDF8" stroke-width="2" />
    <rect x="40" y="80" width="220" height="36" rx="8" fill="#0284C7" />
    <text x="150" y="104" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle">students (Left Table)</text>
    
    <g font-family="monospace" font-size="12" fill="#E2E8F0">
      <text x="55" y="140" fill="#94A3B8">student_id | name</text>
      <line x1="50" y1="148" x2="245" y2="148" stroke="#334155" stroke-width="1" />
      <text x="55" y="172">101        | Alex</text>
      <text x="55" y="196">102        | Priya</text>
      <text x="55" y="220">103        | Rohan</text>
      <text x="55" y="244" fill="#FDE047" font-weight="700">104        | Sarah</text>
    </g>

    <!-- Query Box in Middle -->
    <rect x="290" y="130" width="180" height="120" rx="8" fill="#0F172A" stroke="#475569" stroke-width="1.5" />
    <text x="380" y="160" font-family="monospace" font-size="12" font-weight="700" fill="#C084FC" text-anchor="middle">SELECT *</text>
    <text x="380" y="180" font-family="monospace" font-size="12" font-weight="700" fill="#C084FC" text-anchor="middle">FROM students s</text>
    <text x="380" y="202" font-family="monospace" font-size="13" font-weight="700" fill="#F59E0B" text-anchor="middle">LEFT JOIN</text>
    <text x="380" y="224" font-family="monospace" font-size="12" font-weight="700" fill="#C084FC" text-anchor="middle">scores sc ON ...</text>

    <!-- Scores Table -->
    <rect x="500" y="80" width="220" height="230" rx="8" fill="#1E293B" stroke="#34D399" stroke-width="2" />
    <rect x="500" y="80" width="220" height="36" rx="8" fill="#059669" />
    <text x="610" y="104" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle">scores (Right Table)</text>
    
    <g font-family="monospace" font-size="12" fill="#E2E8F0">
      <text x="515" y="140" fill="#94A3B8">student_id | score</text>
      <line x1="510" y1="148" x2="705" y2="148" stroke="#334155" stroke-width="1" />
      <text x="515" y="172">101        | 92</text>
      <text x="515" y="196">102        | 88</text>
      <text x="515" y="220">103        | 95</text>
      <text x="515" y="244" fill="#EF4444" font-style="italic">-- (no record for 104) --</text>
    </g>
    
    <text x="380" y="340" font-family="system-ui, sans-serif" font-size="12" fill="#94A3B8" text-anchor="middle">Notice student 104 has no corresponding score record</text>
      `
    })
  },
  {
    filename: 'q48-db-indexing.svg',
    content: makeCodeWindowSvg({
      title: 'Database B-Tree Index SARGability & Query Optimization',
      language: 'POSTGRESQL',
      lines: [
        [
          { text: '-- B-Tree Index definition:', color: '#94A3B8' }
        ],
        [
          { text: 'CREATE INDEX ', color: '#C084FC', bold: true },
          { text: 'idx_created_at ', color: '#38BDF8' },
          { text: 'ON ', color: '#C084FC', bold: true },
          { text: 'assessment_logs (created_at);', color: '#E2E8F0' }
        ],
        '',
        [
          { text: '-- Query 1:', color: '#94A3B8' }
        ],
        [
          { text: 'SELECT * FROM assessment_logs WHERE created_at >= ', color: '#E2E8F0' },
          { text: "'2026-01-01';", color: '#34D399' }
        ],
        '',
        [
          { text: '-- Query 2:', color: '#94A3B8' }
        ],
        [
          { text: 'SELECT * FROM assessment_logs WHERE ', color: '#E2E8F0' },
          { text: 'EXTRACT', color: '#F59E0B', bold: true },
          { text: '(YEAR FROM created_at) = 2026;', color: '#E2E8F0' }
        ]
      ]
    })
  },
  {
    filename: 'q49-env-security.svg',
    content: makeCodeWindowSvg({
      title: 'Environment Variable Security: Client Bundles vs Server Runtime',
      language: 'DOTENV CONFIG',
      lines: [
        [
          { text: '# Frontend client-exposed build variables (Inlined into JS bundles)', color: '#94A3B8' }
        ],
        [
          { text: 'NEXT_PUBLIC_APP_TITLE', color: '#38BDF8' },
          { text: '="Data Valley Assessment Platform"', color: '#FDE047' }
        ],
        [
          { text: 'NEXT_PUBLIC_API_URL', color: '#38BDF8' },
          { text: '="https://api.datavalley.ai"', color: '#FDE047' }
        ],
        [
          { text: 'NEXT_PUBLIC_ENABLE_PROCTORING', color: '#38BDF8' },
          { text: '="true"', color: '#FDE047' }
        ],
        '',
        [
          { text: '# Server-only secure secrets (Never bundled or exposed to browsers)', color: '#94A3B8' }
        ],
        [
          { text: 'MONGODB_URI', color: '#EF4444', bold: true },
          { text: '="mongodb+srv://admin:pass@cluster.mongodb.net/prod"', color: '#F87171' }
        ],
        [
          { text: 'JWT_SECRET', color: '#EF4444', bold: true },
          { text: '="super-secure-production-jwt-token-string-32"', color: '#F87171' }
        ]
      ]
    })
  },
  {
    filename: 'q50-arch-loadbalancer.svg',
    content: makeDiagramSvg({
      title: 'Production Web Deployment: Reverse Proxy & Horizontal Scaling',
      height: 400,
      elements: `
    <!-- Client Browsers -->
    <rect x="280" y="60" width="200" height="42" rx="8" fill="#1E293B" stroke="#94A3B8" stroke-width="1.5" />
    <text x="380" y="86" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#E2E8F0" text-anchor="middle">Candidate Client Browsers</text>
    
    <path d="M 380 102 L 380 128" fill="none" stroke="#38BDF8" stroke-width="2" marker-end="url(#arrow)" />

    <!-- CDN Box -->
    <rect x="260" y="130" width="240" height="42" rx="8" fill="#1E293B" stroke="#38BDF8" stroke-width="2" />
    <text x="380" y="156" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#38BDF8" text-anchor="middle">Edge CDN &amp; SSL Termination</text>
    
    <path d="M 380 172 L 380 198" fill="none" stroke="#38BDF8" stroke-width="2" marker-end="url(#arrow)" />

    <!-- Reverse Proxy Box -->
    <rect x="230" y="200" width="300" height="48" rx="8" fill="#0284C7" stroke="#38BDF8" stroke-width="2" />
    <text x="380" y="230" font-family="system-ui, sans-serif" font-size="13" font-weight="800" fill="#FFFFFF" text-anchor="middle">[ Reverse Proxy / Load Balancer ]</text>

    <!-- Branching arrows to instances -->
    <path d="M 280 248 L 140 280" fill="none" stroke="#34D399" stroke-width="2" marker-end="url(#arrow-green)" />
    <path d="M 380 248 L 380 280" fill="none" stroke="#34D399" stroke-width="2" marker-end="url(#arrow-green)" />
    <path d="M 480 248 L 620 280" fill="none" stroke="#34D399" stroke-width="2" marker-end="url(#arrow-green)" />

    <!-- App Instances -->
    <rect x="60" y="284" width="160" height="42" rx="6" fill="#1E293B" stroke="#34D399" stroke-width="1.5" />
    <text x="140" y="310" font-family="monospace" font-size="11" font-weight="700" fill="#34D399" text-anchor="middle">App Instance 1</text>

    <rect x="300" y="284" width="160" height="42" rx="6" fill="#1E293B" stroke="#34D399" stroke-width="1.5" />
    <text x="380" y="310" font-family="monospace" font-size="11" font-weight="700" fill="#34D399" text-anchor="middle">App Instance 2</text>

    <rect x="540" y="284" width="160" height="42" rx="6" fill="#1E293B" stroke="#34D399" stroke-width="1.5" />
    <text x="620" y="310" font-family="monospace" font-size="11" font-weight="700" fill="#34D399" text-anchor="middle">App Instance 3</text>

    <!-- Database Box -->
    <path d="M 140 326 L 310 365" fill="none" stroke="#475569" stroke-width="1.5" />
    <path d="M 380 326 L 380 355" fill="none" stroke="#475569" stroke-width="1.5" />
    <path d="M 620 326 L 450 365" fill="none" stroke="#475569" stroke-width="1.5" />

    <rect x="250" y="355" width="260" height="34" rx="6" fill="#0F172A" stroke="#F59E0B" stroke-width="1.5" />
    <text x="380" y="377" font-family="monospace" font-size="11" font-weight="700" fill="#F59E0B" text-anchor="middle">Managed MongoDB / SQL Database</text>
      `
    })
  }
];

for (const asset of assets) {
  const filePath = path.join(publicDir, asset.filename);
  fs.writeFileSync(filePath, asset.content, 'utf8');
  console.log(`Generated: ${asset.filename}`);
}

console.log(`Successfully generated all ${assets.length} technical SVG assets!`);
