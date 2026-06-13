const fs = require('fs');
const path = require('path');

const filePath = path.join(
  'c:', 'Users', 'localhost', 'Documents', 'Enrollpro',
  'server', 'src', 'features', 'students', 'students.router.ts'
);

let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /verifyPsa,/,
  "verifyPsa,\n  updateLrn,\n  markDropout,\n  markTransferredOut,"
);

const routes = `
// Lifecycle & LRN Management
router.post(
  "/:id/lifecycle/dropout",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  markDropout
);

router.post(
  "/:id/lifecycle/transfer-out",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  markTransferredOut
);

router.post(
  "/:id/lrn",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  updateLrn
);

export default router;
`;

content = content.replace(/export default router;/, routes);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated students.router.ts");
