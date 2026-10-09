const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/server/src/features/integration/integration.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'userId: teacher.employeeId ? (userIdByEmployeeId.get(teacher.employeeId) ?? null) : null,',
  `userId: teacher.employeeId ? (userByEmployeeId.get(teacher.employeeId)?.id ?? null) : null,
      suffix: teacher.suffix ?? null,
      sex: teacher.sex ?? null,
      birthdate: teacher.birthdate ?? null,
      personnelType: teacher.personnelType ?? null,
      functionalAssignment: teacher.functionalAssignment ?? null,
      bachelorMajor: teacher.bachelorMajor ?? null,
      bachelorMinor: teacher.bachelorMinor ?? null,
      indigenousCommunity: teacher.indigenousCommunity ?? null,
      fundingSource: teacher.fundingSource ?? null,
      serviceStatus: teacher.serviceStatus ?? null,
      serviceEffectiveDate: teacher.serviceEffectiveDate ?? null,
      serviceRemarks: teacher.serviceRemarks ?? null,
      portalActive: teacher.employeeId ? (userByEmployeeId.get(teacher.employeeId)?.isActive ?? false) : false,
      accessExpirationDate: teacher.employeeId ? (userByEmployeeId.get(teacher.employeeId)?.accessExpirationDate ?? null) : null,
      roles: teacher.employeeId ? (userByEmployeeId.get(teacher.employeeId)?.roles ?? []) : [],
      postgraduateDegrees: teacher.postgraduateDegrees ?? [],`
);

content = content.replace(
  'effectiveTo: designation?.effectiveTo ?? null,',
  `effectiveTo: designation?.effectiveTo ?? null,
      atlasAssignTeachingLoad: designation?.atlasAssignTeachingLoad ?? false,
      atlasBuildSchedules: designation?.atlasBuildSchedules ?? false,`
);

fs.writeFileSync(file, content);
console.log('Done');
