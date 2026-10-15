const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

function wrapEmail(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F1F5F9" />
  <rect x="50" y="30" width="700" height="340" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
  <rect x="50" y="30" width="700" height="40" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1" />
  <circle cx="70" cy="50" r="6" fill="#EF4444" />
  <circle cx="90" cy="50" r="6" fill="#F59E0B" />
  <circle cx="110" cy="50" r="6" fill="#10B981" />
  <g font-family="system-ui, sans-serif" font-size="16" fill="#334155">
    ${content}
  </g>
</svg>`;
}

const q01 = wrapEmail(`
  <text x="80" y="100" font-weight="bold">To:</text>
  <text x="130" y="100">Manager</text>
  <line x1="80" y1="120" x2="720" y2="120" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="150" font-weight="bold">Subject:</text>
  <rect x="150" y="130" width="570" height="30" rx="4" fill="#F1F5F9" />
  <text x="160" y="150" fill="#94A3B8">[ Candidate selects subject line ]</text>
  <line x1="80" y1="170" x2="720" y2="170" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="210">Hi Manager,</text>
  <text x="80" y="240">I have completed the assigned project task...</text>
`);

const q02 = wrapEmail(`
  <text x="80" y="100" font-weight="bold">From:</text>
  <text x="140" y="100">Sarah (Client)</text>
  <line x1="80" y1="120" x2="720" y2="120" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="150" font-weight="bold">Subject:</text>
  <text x="150" y="150">Project Update</text>
  <line x1="80" y1="170" x2="720" y2="170" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="210">Hello Team,</text>
  <text x="80" y="240">Could you please let us know the current status of the project?</text>
  <text x="80" y="270">We were expecting an update today.</text>
  <text x="80" y="310">Thanks,</text>
  <text x="80" y="330">Sarah</text>
`);

const q03 = wrapEmail(`
  <text x="80" y="100" font-weight="bold">To:</text>
  <text x="130" y="100">Manager</text>
  <line x1="80" y1="120" x2="720" y2="120" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="150" font-weight="bold">Subject:</text>
  <text x="150" y="150">Weekly Report</text>
  <line x1="80" y1="170" x2="720" y2="170" stroke="#E2E8F0" stroke-width="1" />
  
  <rect x="80" y="190" width="200" height="40" rx="4" fill="#E2E8F0" />
  <text x="95" y="215" font-size="14" fill="#0F172A">📎 weekly_report.pdf</text>
  
  <text x="80" y="270">Please find the weekly report attached.</text>
`);

const q04 = wrapEmail(`
  <text x="80" y="100" font-weight="bold">To:</text>
  <text x="130" y="100">Project Manager</text>
  <line x1="80" y1="120" x2="720" y2="120" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="150" font-weight="bold">CC:</text>
  <text x="130" y="150">Team Lead</text>
  <line x1="80" y1="170" x2="720" y2="170" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="210">Hi,</text>
  <text x="80" y="240">Here is the latest project update...</text>
`);

const q05 = wrapEmail(`
  <text x="80" y="100" font-weight="bold">To:</text>
  <text x="130" y="100">Manager</text>
  <line x1="80" y1="120" x2="720" y2="120" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="150" font-weight="bold">Subject:</text>
  <text x="150" y="150">API Integration Update</text>
  <line x1="80" y1="170" x2="720" y2="170" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="210">Hi Manager,</text>
  <text x="80" y="240">The API integration task is currently delayed because</text>
  <text x="80" y="265">the required endpoint information is still pending.</text>
`);

const q06 = wrapEmail(`
  <text x="80" y="100" font-style="italic" fill="#64748B">-- Previous Email --</text>
  <text x="80" y="130" font-weight="bold">To:</text>
  <text x="130" y="130">Senior Developer</text>
  <text x="80" y="160" font-weight="bold">Subject:</text>
  <text x="150" y="160">API Integration Question</text>
  <line x1="80" y1="180" x2="720" y2="180" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="210">Hi,</text>
  <text x="80" y="240">Could you clarify the parameters for the new endpoint?</text>
  <rect x="80" y="280" width="640" height="40" rx="4" fill="#FEF2F2" stroke="#F87171" stroke-width="1" />
  <text x="100" y="305" fill="#B91C1C" font-weight="bold">Status: No response received after 2 days.</text>
`);

const q07 = wrapEmail(`
  <text x="80" y="100" font-weight="bold">From:</text>
  <text x="140" y="100">Colleague</text>
  <line x1="80" y1="120" x2="720" y2="120" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="150" font-weight="bold">Subject:</text>
  <text x="150" y="150">URGENT</text>
  <line x1="80" y1="170" x2="720" y2="170" stroke="#E2E8F0" stroke-width="1" />
  <text x="80" y="220" font-weight="bold" fill="#B91C1C">WHY HAVEN'T YOU FINISHED THIS YET???</text>
  <text x="80" y="260" font-weight="bold" fill="#B91C1C">THIS IS VERY BAD.</text>
  <text x="80" y="300" font-weight="bold" fill="#B91C1C">FIX IT NOW.</text>
`);

const q08 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#F1F5F9" />
  
  <!-- Email A -->
  <rect x="30" y="30" width="355" height="340" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
  <rect x="30" y="30" width="355" height="40" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1" />
  <text x="180" y="55" font-family="system-ui" font-size="16" font-weight="bold" fill="#475569">EMAIL A</text>
  <g font-family="system-ui, sans-serif" font-size="14" fill="#334155">
    <text x="50" y="100" font-weight="bold">Subject:</text>
    <text x="110" y="100">Update</text>
    <line x1="50" y1="120" x2="365" y2="120" stroke="#E2E8F0" stroke-width="1" />
    <text x="50" y="150">Hi,</text>
    <text x="50" y="180">The thing we discussed is almost done.</text>
    <text x="50" y="200">Will tell you later.</text>
  </g>

  <!-- Email B -->
  <rect x="415" y="30" width="355" height="340" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
  <rect x="415" y="30" width="355" height="40" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1" />
  <text x="565" y="55" font-family="system-ui" font-size="16" font-weight="bold" fill="#475569">EMAIL B</text>
  <g font-family="system-ui, sans-serif" font-size="14" fill="#334155">
    <text x="435" y="100" font-weight="bold">Subject:</text>
    <text x="495" y="100">Project Dashboard — Status Update</text>
    <line x1="435" y1="120" x2="750" y2="120" stroke="#E2E8F0" stroke-width="1" />
    <text x="435" y="150">Hi Sarah,</text>
    <text x="435" y="180">The dashboard update is currently in</text>
    <text x="435" y="200">progress. We expect to complete it by</text>
    <text x="435" y="220">4 PM today and will share the updated</text>
    <text x="435" y="240">version once it is ready.</text>
    <text x="435" y="280">Regards,</text>
    <text x="435" y="300">Alex</text>
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'q01-email.svg'), q01);
fs.writeFileSync(path.join(publicDir, 'q02-email.svg'), q02);
fs.writeFileSync(path.join(publicDir, 'q03-email.svg'), q03);
fs.writeFileSync(path.join(publicDir, 'q04-email.svg'), q04);
fs.writeFileSync(path.join(publicDir, 'q05-email.svg'), q05);
fs.writeFileSync(path.join(publicDir, 'q06-email.svg'), q06);
fs.writeFileSync(path.join(publicDir, 'q07-email.svg'), q07);
fs.writeFileSync(path.join(publicDir, 'q08-email.svg'), q08);

console.log('Created 8 SVGs for Section 1');
