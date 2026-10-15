const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 26: Git Workflow
const gitWorkflowSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <g font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle">
    <rect x="50" y="150" width="150" height="100" rx="12" fill="#E2E8F0" stroke="#94A3B8" stroke-width="2"/>
    <text x="125" y="205" fill="#334155" font-size="16">Working Directory</text>
    
    <rect x="300" y="150" width="150" height="100" rx="12" fill="#DBEAFE" stroke="#60A5FA" stroke-width="2"/>
    <text x="375" y="205" fill="#1D4ED8" font-size="16">Staging Area</text>
    
    <rect x="550" y="150" width="150" height="100" rx="12" fill="#D1FAE5" stroke="#34D399" stroke-width="2"/>
    <text x="625" y="205" fill="#047857" font-size="16">Local Repository</text>

    <!-- Arrows -->
    <path d="M 210 200 L 290 200" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arrow)"/>
    <text x="250" y="190" fill="#64748B" font-size="14" font-weight="700">git add</text>
    
    <path d="M 460 200 L 540 200" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arrow)"/>
    <text x="500" y="190" fill="#64748B" font-size="14" font-weight="700">git commit</text>
  </g>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#94A3B8" />
    </marker>
  </defs>
</svg>`;

// 27: Git Branch
const gitBranchSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <g font-family="system-ui, sans-serif" font-weight="700">
    <path d="M 100 150 L 700 150" fill="none" stroke="#94A3B8" stroke-width="4"/>
    <path d="M 300 150 L 400 250 L 600 250" fill="none" stroke="#3B82F6" stroke-width="4"/>
    
    <circle cx="100" cy="150" r="12" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>
    <circle cx="300" cy="150" r="12" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>
    <circle cx="500" cy="150" r="12" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>
    <circle cx="700" cy="150" r="12" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>
    
    <circle cx="400" cy="250" r="12" fill="#DBEAFE" stroke="#3B82F6" stroke-width="4"/>
    <circle cx="600" cy="250" r="12" fill="#DBEAFE" stroke="#3B82F6" stroke-width="4"/>

    <text x="730" y="155" fill="#475569" font-size="18">main</text>
    <text x="630" y="255" fill="#2563EB" font-size="18">feature-login</text>
  </g>
</svg>`;

// 28: Git Merge
const gitMergeSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <g font-family="system-ui, sans-serif" font-weight="700">
    <path d="M 100 150 L 700 150" fill="none" stroke="#94A3B8" stroke-width="4"/>
    <path d="M 250 150 L 350 250 L 550 250 L 650 150" fill="none" stroke="#10B981" stroke-width="4"/>
    
    <circle cx="100" cy="150" r="12" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>
    <circle cx="250" cy="150" r="12" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>
    <circle cx="650" cy="150" r="12" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>
    <circle cx="750" cy="150" r="12" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>
    
    <circle cx="350" cy="250" r="12" fill="#D1FAE5" stroke="#10B981" stroke-width="4"/>
    <circle cx="550" cy="250" r="12" fill="#D1FAE5" stroke="#10B981" stroke-width="4"/>

    <text x="730" y="115" fill="#475569" font-size="18">main</text>
    <text x="500" y="295" fill="#059669" font-size="18">feature</text>
  </g>
</svg>`;

// 29: Git Status Terminal
const gitStatusSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <rect x="100" y="50" width="600" height="300" rx="8" fill="#0F172A" />
  <circle cx="120" cy="70" r="6" fill="#EF4444"/>
  <circle cx="140" cy="70" r="6" fill="#F59E0B"/>
  <circle cx="160" cy="70" r="6" fill="#10B981"/>
  
  <g font-family="monospace" font-size="16" fill="#E2E8F0">
    <text x="120" y="115" fill="#10B981">$</text>
    <text x="140" y="115">git status</text>
    <text x="120" y="155">Changes not staged for commit:</text>
    <text x="120" y="175">  (use "git add &lt;file&gt;..." to update what will be committed)</text>
    <text x="120" y="205" fill="#EF4444">        modified:   app.py</text>
    <text x="120" y="245">Untracked files:</text>
    <text x="120" y="265">  (use "git add &lt;file&gt;..." to include in what will be committed)</text>
    <text x="120" y="295" fill="#EF4444">        login.py</text>
  </g>
</svg>`;

// 30: Git Push
const gitPushSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F8FAFC" />
  <g font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle">
    <rect x="150" y="100" width="200" height="200" rx="16" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>
    <text x="250" y="180" fill="#334155" font-size="22" font-weight="800">LOCAL</text>
    <text x="250" y="210" fill="#64748B" font-size="16">REPOSITORY</text>
    
    <rect x="450" y="100" width="200" height="200" rx="16" fill="#F1F5F9" stroke="#94A3B8" stroke-width="4" stroke-dasharray="10 5"/>
    <text x="550" y="180" fill="#475569" font-size="22" font-weight="800">REMOTE</text>
    <text x="550" y="210" fill="#94A3B8" font-size="16">REPOSITORY</text>

    <!-- Arrow -->
    <path d="M 370 200 L 430 200" fill="none" stroke="#3B82F6" stroke-width="6" marker-end="url(#arrow)"/>
    <text x="400" y="185" fill="#2563EB" font-size="16" font-weight="800">git push</text>
  </g>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L7,3 z" fill="#3B82F6" />
    </marker>
  </defs>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'git-workflow.svg'), gitWorkflowSVG);
fs.writeFileSync(path.join(publicDir, 'git-branch.svg'), gitBranchSVG);
fs.writeFileSync(path.join(publicDir, 'git-merge.svg'), gitMergeSVG);
fs.writeFileSync(path.join(publicDir, 'git-status.svg'), gitStatusSVG);
fs.writeFileSync(path.join(publicDir, 'git-push.svg'), gitPushSVG);

console.log('Created 5 SVGs in public folder.');
