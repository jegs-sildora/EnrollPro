const fs = require('fs'); 
let c = fs.readFileSync('tools/qa-extension/content.js', 'utf8');

c = c.replace(/await fillRadixComboboxByLabel\("Region"\);/g, 'await fillRadixComboboxByLabel("Region", "NEGROS ISLAND REGION");');
c = c.replace(/await fillRadixComboboxByLabel\("Province"\);/g, 'await fillRadixComboboxByLabel("Province", "NEGROS OCCIDENTAL");');
c = c.replace(/await fillRadixComboboxByLabel\("City \/ Municipality"\);/g, 'await fillRadixComboboxByLabel("City / Municipality", "HINIGARAN");');

c = c.replace(/lastSchoolName: .*?,/, 'lastSchoolName: "HINIGARAN ELEMENTARY SCHOOL-B",');
c = c.replace(/lastSchoolId: .*?,/, 'lastSchoolId: "117114",');
c = c.replace(/lastSchoolAddress: .*?,/, 'lastSchoolAddress: "7VC2+623, Rizal St, Hinigaran, Negros Occidental",');

c = c.replace(/await fillRadixComboboxByLabel\("School Year Last Attended"\);/g, 'await fillRadixComboboxByLabel("School Year Last Attended", "FIRST");');

c = c.replace('if (optionText) {', 'if (optionText === "FIRST") {\n      valid[0].click();\n    } else if (optionText) {');

let buttonGroupAdditions = `
  await fillButtonGroupByLabel("Is the learner a member of an IP cultural community?", data.isIpCommunity ? "YES" : "NO");
  await fillButtonGroupByLabel("Does the learner's household currently receive benefits under the Pantawid Pamilyang Pilipino Program (4Ps)?", data.is4PsBeneficiary ? "YES" : "NO");
  await fillButtonGroupByLabel("Is the learner under the Special Needs Education Program?", data.isLearnerWithDisability ? "YES" : "NO");
  await fillButtonGroupByLabel("Is this learner returning to school after a gap of 1 year or more? (Balik-Aral)", data.isBalikAral ? "YES" : "NO");

  const modalitiesDiv = document.getElementById("learningModalities");
  if (modalitiesDiv) {
    const buttons = modalitiesDiv.querySelectorAll("button[role='checkbox']");
    if (buttons.length > 0) {
      buttons[0].click();
    }
  }
`;
c = c.replace('await fillButtonGroupByLabel("Sex"', buttonGroupAdditions + '\n  await fillButtonGroupByLabel("Sex"');

fs.writeFileSync('tools/qa-extension/content.js', c);
