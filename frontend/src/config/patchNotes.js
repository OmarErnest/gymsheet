/**
 * PATCH NOTES CONFIG
 * 
 * HOW TO SHIP A HOTFIX / NEW PATCH:
 * 1. Bump CURRENT_VERSION (use semver: major.minor.patch or 'vX.Y build DATE')
 * 2. Add a new entry at the TOP of PATCH_NOTES (most recent first).
 * 3. Deploy the frontend. Users who haven't seen this version yet will get
 *    the "What's New" modal automatically on their next visit.
 *
 * Entry types:
 *   'fix'     → 🐛 Bug fix
 *   'feature' → ✨ New feature
 *   'hotfix'  → 🔥 Critical fix (highlighted in red)
 *   'improve' → ⚡ Improvement / polish
 */

export const CURRENT_VERSION = 'v-03a.40';

export const PATCH_NOTES = [
  {
    version: 'v-03a.40',
    date: '2026-05-10',
    title: 'Home UI & Day Swap Update',
    changes: [
      { type: 'feature', text: 'Day Swap: Easily rearrange your workout week using the new Swap mode in the Home header.' },
      { type: 'improve', text: 'Classic Navigation: Reverted to arrow-based week switching with a centered, more accessible layout.' },
      { type: 'improve', text: 'Week Indicator: Added a clean relative week label (-6 to +1) directly to the Calendar button.' },
      { type: 'improve', text: 'Compact View: Renamed Spreadsheet view to "SHEET" for better fit on mobile devices.' },
      { type: 'fix', text: 'Resolved missing Profile Menu action in the Command Palette search.' },
      { type: 'fix', text: 'Centered header controls to prevent overflow on various screen sizes.' },
    ],
  },
  {
    version: 'v-03a.039',
    date: '2026-05-04',
    title: 'Stability & Sanitize Update',
    changes: [
      { type: 'fix', text: 'Empty exercise inputs no longer silently delete your saved log data.' },
      { type: 'fix', text: 'Leaderboard now loads instantly on revisit instead of refetching every tab switch.' },
      { type: 'feature', text: 'New Danger Zone in Settings: request full account data sanitization (requires admin approval).' },
      { type: 'feature', text: 'Admin panel now shows pending sanitize requests with approve/reject actions.' },
      { type: 'improve', text: 'Added a ↻ refresh button to the leaderboard hero card.' },
    ],
  },
  {
    version: 'v-03a.038',
    date: '2026-04-30',
    title: 'Badge System & Stability',
    changes: [
      { type: 'fix', text: 'Resolved "Settings is not defined" crash on Profile page in production.' },
      { type: 'fix', text: 'Badge icons no longer render with a white background.' },
      { type: 'fix', text: 'Contact Admin no longer returns 500 errors.' },
      { type: 'feature', text: 'Push button now only affects the selected day without deleting existing content.' },
    ],
  },
];
