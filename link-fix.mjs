import fs from 'node:fs';
import path from 'node:path';

const organizerPath = path.join(process.cwd(), 'components/organizer/organizer-dashboard.tsx');
let organizerSource = fs.readFileSync(organizerPath, 'utf8');
organizerSource = organizerSource.replace(
  'const invitationUrl = siteOrigin ? `${siteOrigin}/#rsvp` : "";',
  'const invitationUrl = siteOrigin ? `${siteOrigin}/` : "";',
);
fs.writeFileSync(organizerPath, organizerSource);

const interactivePath = path.join(process.cwd(), 'components/wedding/interactive.tsx');
let interactiveSource = fs.readFileSync(interactivePath, 'utf8');
interactiveSource = interactiveSource.replace(
  'const link = `${window.location.origin}/#rsvp`;',
  'const link = `${window.location.origin}/`;',
);
fs.writeFileSync(interactivePath, interactiveSource);

console.log('Guest invitation/share links now open at the envelope without #rsvp.');
