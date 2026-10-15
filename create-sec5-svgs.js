const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');

function save(name, content) {
  fs.writeFileSync(path.join(publicDir, name), content);
}

// Common styles
const bg = '<rect width="100%" height="100%" fill="#F8FAFC" />';
const font = 'font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle"';

// Q51 - Number Pattern
const q51 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="100%" height="100%">
  ${bg}
  <g ${font} font-size="40" fill="#1E293B">
    <rect x="50" y="60" width="80" height="80" rx="12" fill="#E2E8F0" />
    <text x="90" y="112">2</text>
    <path d="M 145 100 L 175 100" fill="none" stroke="#94A3B8" stroke-width="4" marker-end="url(#arr)"/>

    <rect x="190" y="60" width="80" height="80" rx="12" fill="#E2E8F0" />
    <text x="230" y="112">4</text>
    <path d="M 285 100 L 315 100" fill="none" stroke="#94A3B8" stroke-width="4" marker-end="url(#arr)"/>

    <rect x="330" y="60" width="80" height="80" rx="12" fill="#E2E8F0" />
    <text x="370" y="112">8</text>
    <path d="M 425 100 L 455 100" fill="none" stroke="#94A3B8" stroke-width="4" marker-end="url(#arr)"/>

    <rect x="470" y="60" width="80" height="80" rx="12" fill="#E2E8F0" />
    <text x="510" y="112">16</text>
    <path d="M 565 100 L 595 100" fill="none" stroke="#94A3B8" stroke-width="4" marker-end="url(#arr)"/>
  </g>
  <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#94A3B8"/></marker></defs>
</svg>`;
save('q51-number.svg', q51);

// Q52 - Shape Pattern
const q52 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="100%" height="100%">
  ${bg}
  <g ${font} font-size="40" fill="#1E293B">
    <circle cx="90" cy="100" r="40" fill="#3B82F6" />
    <path d="M 145 100 L 175 100" fill="none" stroke="#94A3B8" stroke-width="4" marker-end="url(#arr)"/>

    <rect x="190" y="60" width="80" height="80" fill="#EF4444" />
    <path d="M 285 100 L 315 100" fill="none" stroke="#94A3B8" stroke-width="4" marker-end="url(#arr)"/>

    <circle cx="370" cy="100" r="40" fill="#3B82F6" />
    <path d="M 425 100 L 455 100" fill="none" stroke="#94A3B8" stroke-width="4" marker-end="url(#arr)"/>

    <rect x="470" y="60" width="80" height="80" fill="#EF4444" />
    <path d="M 565 100 L 595 100" fill="none" stroke="#94A3B8" stroke-width="4" marker-end="url(#arr)"/>
  </g>
  <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#94A3B8"/></marker></defs>
</svg>`;
save('q52-shape.svg', q52);

// Q53 - Bar Chart
const q53 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="100%" height="100%">
  ${bg}
  <g ${font} font-size="16" fill="#475569">
    <line x1="100" y1="250" x2="550" y2="250" stroke="#CBD5E1" stroke-width="4" />
    <line x1="100" y1="250" x2="100" y2="50" stroke="#CBD5E1" stroke-width="4" />
    
    <!-- MONDAY 20 -->
    <rect x="130" y="150" width="60" height="100" fill="#60A5FA" />
    <text x="160" y="275">MON</text>
    <text x="160" y="140" font-size="20" fill="#1E293B">20</text>
    
    <!-- TUESDAY 35 -->
    <rect x="230" y="75" width="60" height="175" fill="#34D399" />
    <text x="260" y="275">TUE</text>
    <text x="260" y="65" font-size="20" fill="#1E293B">35</text>
    
    <!-- WEDNESDAY 25 -->
    <rect x="330" y="125" width="60" height="125" fill="#FBBF24" />
    <text x="360" y="275">WED</text>
    <text x="360" y="115" font-size="20" fill="#1E293B">25</text>
    
    <!-- THURSDAY 40 -->
    <rect x="430" y="50" width="60" height="200" fill="#F87171" />
    <text x="460" y="275">THU</text>
    <text x="460" y="40" font-size="20" fill="#1E293B">40</text>
  </g>
</svg>`;
save('q53-chart.svg', q53);

// Q54 - Ratio
const q54 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="100%" height="100%">
  ${bg}
  <g ${font} font-size="32" fill="#1E293B">
    <rect x="150" y="40" width="300" height="120" rx="16" fill="#FFF" stroke="#E2E8F0" stroke-width="4" />
    <text x="300" y="85" fill="#475569" font-size="24">FRONTEND : BACKEND</text>
    <text x="300" y="130" font-size="40" fill="#3B82F6">3 : 2</text>
  </g>
</svg>`;
save('q54-ratio.svg', q54);

// Q55 - Timeline
const q55 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="100%" height="100%">
  ${bg}
  <g ${font} font-size="24" fill="#1E293B">
    <rect x="100" y="50" width="400" height="100" rx="12" fill="#FFF" stroke="#E2E8F0" stroke-width="4"/>
    <text x="170" y="90" fill="#3B82F6">Task A</text>
    <text x="170" y="120" fill="#64748B" font-size="18">2 hours</text>
    
    <path d="M 230 100 L 270 100" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    
    <text x="330" y="90" fill="#10B981">Task B</text>
    <text x="330" y="120" fill="#64748B" font-size="18">3 hours</text>

    <path d="M 390 100 L 430 100" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <text x="475" y="90" fill="#F59E0B">Task C</text>
    <text x="475" y="120" fill="#64748B" font-size="18">1 hour</text>
  </g>
  <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#94A3B8"/></marker></defs>
</svg>`;
save('q55-time.svg', q55);

// Q56 - Probability
const q56 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="100%" height="100%">
  ${bg}
  <g ${font}>
    <rect x="150" y="30" width="300" height="140" rx="12" fill="#FFF" stroke="#E2E8F0" stroke-width="4" />
    
    <circle cx="210" cy="80" r="25" fill="#EF4444" />
    <circle cx="280" cy="80" r="25" fill="#EF4444" />
    <circle cx="350" cy="80" r="25" fill="#EF4444" />
    
    <circle cx="245" cy="140" r="25" fill="#3B82F6" />
    <circle cx="315" cy="140" r="25" fill="#3B82F6" />
  </g>
</svg>`;
save('q56-prob.svg', q56);

// Q57 - Teams
const q57 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 250" width="100%" height="100%">
  ${bg}
  <g ${font} font-size="24">
    <rect x="150" y="30" width="300" height="190" rx="12" fill="#FFF" stroke="#E2E8F0" stroke-width="4" />
    <text x="240" y="75" fill="#475569">Team A:</text>
    <text x="350" y="75" fill="#3B82F6" font-size="32">4</text>
    
    <text x="240" y="135" fill="#475569">Team B:</text>
    <text x="350" y="135" fill="#10B981" font-size="32">6</text>
    
    <text x="240" y="195" fill="#475569">Team C:</text>
    <text x="350" y="195" fill="#F59E0B" font-size="32">5</text>
  </g>
</svg>`;
save('q57-teams.svg', q57);

// Q58 - Servers
const q58 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 250" width="100%" height="100%">
  ${bg}
  <g ${font} font-size="24">
    <rect x="50" y="50" width="140" height="150" rx="12" fill="#FFF" stroke="#E2E8F0" stroke-width="4" />
    <text x="120" y="90" fill="#1E293B">Server A</text>
    <text x="120" y="140" fill="#EF4444" font-size="32">200ms</text>

    <rect x="230" y="50" width="140" height="150" rx="12" fill="#FFF" stroke="#E2E8F0" stroke-width="4" />
    <text x="300" y="90" fill="#1E293B">Server B</text>
    <text x="300" y="140" fill="#EF4444" font-size="32">450ms</text>

    <rect x="410" y="50" width="140" height="150" rx="12" fill="#FFF" stroke="#E2E8F0" stroke-width="4" />
    <text x="480" y="90" fill="#1E293B">Server C</text>
    <text x="480" y="140" fill="#EF4444" font-size="32">300ms</text>
  </g>
</svg>`;
save('q58-server.svg', q58);

// Q59 - Dashboard
const q59 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="100%" height="100%">
  ${bg}
  <g ${font} font-size="24">
    <rect x="100" y="30" width="400" height="140" rx="12" fill="#0F172A" />
    <text x="300" y="70" fill="#94A3B8">API Response Time</text>
    <text x="300" y="110" fill="#EF4444">Before: 900 ms</text>
    <text x="300" y="150" fill="#10B981">After: 300 ms</text>
  </g>
</svg>`;
save('q59-decision.svg', q59);

// Q60 - System Arch
const q60 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300" width="100%" height="100%">
  ${bg}
  <g ${font} font-size="16">
    <!-- Arch 1 -->
    <text x="200" y="40" fill="#475569">USERS</text>
    <path d="M 200 50 L 200 80" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    <rect x="120" y="90" width="160" height="40" rx="8" fill="#DBEAFE" stroke="#3B82F6" stroke-width="2"/>
    <text x="200" y="116" fill="#1D4ED8">APPLICATION</text>
    <path d="M 200 140 L 200 170" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    <text x="200" y="200" fill="#B45309">DATABASE</text>

    <!-- Divider -->
    <line x1="400" y1="20" x2="400" y2="280" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="8 8" />

    <!-- Arch 2 -->
    <text x="600" y="40" fill="#475569">USERS</text>
    <path d="M 600 50 L 600 80" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    <rect x="500" y="90" width="200" height="40" rx="8" fill="#D1FAE5" stroke="#10B981" stroke-width="2"/>
    <text x="600" y="116" fill="#047857">LOAD BALANCER</text>
    
    <path d="M 580 140 L 520 170" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    <path d="M 620 140 L 680 170" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    
    <rect x="460" y="180" width="120" height="40" rx="8" fill="#E0E7FF" stroke="#4F46E5" stroke-width="2"/>
    <text x="520" y="206" fill="#3730A3">SERVER 1</text>
    
    <rect x="620" y="180" width="120" height="40" rx="8" fill="#E0E7FF" stroke="#4F46E5" stroke-width="2"/>
    <text x="680" y="206" fill="#3730A3">SERVER 2</text>

    <path d="M 540 230 L 580 250" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>
    <path d="M 660 230 L 620 250" fill="none" stroke="#94A3B8" stroke-width="3" marker-end="url(#arr)"/>

    <text x="600" y="275" fill="#B45309">DATABASE</text>
  </g>
  <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#94A3B8"/></marker></defs>
</svg>`;
save('q60-system.svg', q60);

console.log('Generated 10 reasoning SVGs');
