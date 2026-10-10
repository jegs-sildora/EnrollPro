const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/server/src/features/auth/auth.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'ancillaryRoles: string[];',
  'ancillaryRoles: string[];\n  photoPath?: string | null;'
);

content = content.replace(
  'ancillaryRoles: user.ancillaryRoles,',
  'ancillaryRoles: user.ancillaryRoles,\n    photoPath: user.photoPath,'
);

content = content.replace(
  'export async function getAncillaryRoles(userId: number): Promise<string[]> {',
  'export async function getTeacherExtraInfo(userId: number): Promise<{ ancillaryRoles: string[], photoPath: string | null }> {'
);

content = content.replace(
  'return ancillaryRoles;',
  'return { ancillaryRoles, photoPath: teacher?.photoPath ?? null };'
);

content = content.replace(
  'const ancillaryRoles = await getAncillaryRoles(user.id);',
  'const { ancillaryRoles, photoPath } = await getTeacherExtraInfo(user.id);'
);

content = content.replace(
  'const ancillaryRoles = await getAncillaryRoles(user.id);',
  'const { ancillaryRoles, photoPath } = await getTeacherExtraInfo(user.id);'
);
content = content.replace(
  'const ancillaryRoles = await getAncillaryRoles(userId);',
  'const { ancillaryRoles, photoPath } = await getTeacherExtraInfo(userId);'
);
content = content.replace(
  'const ancillaryRoles = await getAncillaryRoles(user.id);',
  'const { ancillaryRoles, photoPath } = await getTeacherExtraInfo(user.id);'
);

// We need to inject photoPath into authUser object everywhere
content = content.replace(
  /const authUser: AuthUser = {\s*\.\.\.user,\s*ancillaryRoles\s*};/g,
  'const authUser: AuthUser = {\n    ...user,\n    ancillaryRoles,\n    photoPath\n  };'
);

content = content.replace(
  /res\.json\({ user: { \.\.\.user, ancillaryRoles } }\);/g,
  'res.json({ user: { ...user, ancillaryRoles, photoPath } });'
);

content = content.replace(
  /return {\s*user: {\s*\.\.\.user,\s*ancillaryRoles\s*},\s*accessToken,\s*};\s*}/g,
  'return { user: { ...user, ancillaryRoles, photoPath }, accessToken }; }'
);

// Add photoPath to JWT token if needed? No, photoPath can just be passed to client.

fs.writeFileSync(file, content);
console.log('patched');
