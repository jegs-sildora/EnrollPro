/**
 * EnrollPro QA Autofill Content Script
 * Injected into the active tab to autofill React-based forms.
 */

const phFirstNamesMale = ["Juan Miguel", "Jose", "Pedro", "Carlo", "Mark", "Angelo", "Paolo", "Luis"];
const phFirstNamesFemale = ["Maria", "Ana", "Luz", "Teresa", "Sofia", "Isabella", "Bianca", "Camille"];
const phLastNames = ["Dela Cruz", "Santos", "Reyes", "Aquino", "Garcia", "Mendoza", "Ramos", "Bautista"];
const phCities = ["Bacolod City", "Talisay City", "Silay City", "Bago City", "Kabankalan City"];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function generateMockData() {
  const isMale = Math.random() > 0.5;
  const firstName = isMale ? randomChoice(phFirstNamesMale) : randomChoice(phFirstNamesFemale);
  const lastName = randomChoice(phLastNames);
  const middleName = randomChoice(phLastNames);
  const motherFirstName = randomChoice(phFirstNamesFemale);
  const fatherFirstName = randomChoice(phFirstNamesMale);

  const lrn = "1" + randomDigits(11);
  const contactNumber = "09" + randomDigits(9);
  const generalAverage = (80 + Math.random() * 18).toFixed(2);

  return {
    studentPhoto: "https://ui-avatars.com/api/?name=" + encodeURIComponent(firstName),
    hasNoLrn: false,
    lrn: lrn,
    psaBirthCertNumber: "PSA-" + randomDigits(10),
    
    lastName: lastName,
    firstName: firstName,
    middleName: middleName,
    extensionName: "", 
    birthdate: "05/15/2013", // Masked text input MM/DD/YYYY format as requested
    sex: isMale ? "MALE" : "FEMALE",
    placeOfBirth: randomChoice(phCities),
    religion: "Catholic",

    isIpCommunity: true,
    ipGroupName: "Ati",
    is4PsBeneficiary: true,
    householdId4Ps: "4PS-" + randomDigits(6),
    
    intakeHeightCm: 150 + Math.floor(Math.random() * 20),
    intakeWeightKg: 45 + Math.floor(Math.random() * 15),

    isBalikAral: true,
    lastYearEnrolled: "2021-2022",
    
    isLearnerWithDisability: true,
    specialNeedsCategory: "a1",
    hasPwdId: true,
    "disabilityTypes.0": "Visual Impairment",
    disabilityTypes: ["Visual Impairment"],

    "currentAddress.houseNoStreet": randomDigits(3) + " Mabini St.",
    "currentAddress.sitio": "Purok 1",
    isPermanentSameAsCurrent: true,

    "mother.lastName": lastName,
    "mother.firstName": motherFirstName,
    "mother.middleName": randomChoice(phLastNames),
    "mother.contactNumber": contactNumber,
    "mother.email": motherFirstName.toLowerCase() + "@example.com",
    "mother.occupation": "Teacher",

    "father.lastName": lastName,
    "father.firstName": fatherFirstName,
    "father.middleName": randomChoice(phLastNames),
    "father.contactNumber": "09" + randomDigits(9),
    "father.email": fatherFirstName.toLowerCase() + "@example.com",
    "father.occupation": "Engineer",

    "guardian.lastName": lastName,
    "guardian.firstName": motherFirstName,
    "guardian.middleName": randomChoice(phLastNames),
    "guardian.contactNumber": contactNumber,
    "guardian.email": motherFirstName.toLowerCase() + "@example.com",
    "guardian.occupation": "Teacher",
    "guardian.relationship": "Mother",

    primaryContact: "MOTHER",
    contactNumber: contactNumber,
    guardianRelationship: "Mother",

    lastSchoolName: "Estefania Elementary School",
    lastSchoolId: "123456",
    lastGradeCompleted: "6",
    schoolYearLastAttended: "2023-2024",
    lastSchoolAddress: randomChoice(phCities),
    transferCertificateNo: "TC-" + randomDigits(5),
    lastSchoolType: "PUBLIC",
    grade5GeneralAverage: generalAverage,
    underSpecialScienceCurriculum: true,

    isScpApplication: true,
    scpType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", 
    artField: "Visual Arts",
    "sportsList.0": "Basketball",
    sportsList: ["Basketball"],
    foreignLanguage: "Spanish",

    gradeLevel: "7",
    learnerType: "NEW_ENROLLEE",
    "learningModalities.0": "BLENDED",
    learningModalities: ["BLENDED"],

    isPrivacyConsentGiven: true,
    hasExecutedAffidavit: true,
    bypassDuplicate: false
  };
}

/**
 * Bypasses React's virtual DOM to set a value on a native input element.
 */
function setReactInputValue(element, value) {
  if (!element) return;
  
  const isCheckboxOrRadio = element.type === 'checkbox' || element.type === 'radio';
  const propertyName = isCheckboxOrRadio ? 'checked' : 'value';

  let prototype = Object.getPrototypeOf(element);
  if (element instanceof HTMLInputElement) prototype = window.HTMLInputElement.prototype;
  else if (element instanceof HTMLTextAreaElement) prototype = window.HTMLTextAreaElement.prototype;
  else if (element instanceof HTMLSelectElement) prototype = window.HTMLSelectElement.prototype;
  else if (element instanceof HTMLButtonElement) prototype = window.HTMLButtonElement.prototype;

  const setter = Object.getOwnPropertyDescriptor(prototype, propertyName)?.set;
  
  if (setter) {
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * UI Automation Helper for Shadcn / Radix Comboboxes & Selects
 * Finds the combobox next to a label, clicks it to open the popover,
 * and randomly selects a valid option.
 */
async function fillRadixComboboxByLabel(labelText, optionText = null) {
  const labels = Array.from(document.querySelectorAll('label'));
  const targetLabel = labels.find(l => {
    const text = l.textContent.replace('*', '').trim().toUpperCase();
    return text === labelText.toUpperCase() || text.startsWith(labelText.toUpperCase());
  });

  if (!targetLabel) return false;

  const container = targetLabel.parentElement;
  if (!container) return false;

  const button = container.querySelector('button[role="combobox"]');
  if (!button) return false;

  // Check if loading or disabled
  if (button.disabled) {
    await wait(800);
    if (button.disabled) return false;
  }

  // Click to open popover
  button.click();
  await wait(400); // Allow animation

  // Shadcn popovers are appended to the body
  const popovers = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper], [data-radix-select-content]'));
  const activePopover = popovers.find(p => p.style.display !== 'none');
  
  if (!activePopover) {
    button.click(); // close it
    return false;
  }

  const options = Array.from(activePopover.querySelectorAll('li > button, [role="option"]'));
  const valid = options.filter(o => {
     const t = o.textContent.trim().toUpperCase();
     return t.length > 0 && !t.includes('NO RESULTS') && !t.includes('SELECT') && !t.includes('LOADING') && !o.disabled && !o.hasAttribute('data-disabled');
  });

  if (valid.length > 0) {
    if (optionText) {
      const match = valid.find(o => o.textContent.toUpperCase().includes(optionText.toUpperCase()));
      if (match) {
        match.click();
      } else {
        valid[Math.floor(Math.random() * valid.length)].click();
      }
    } else {
      valid[Math.floor(Math.random() * valid.length)].click();
    }
    await wait(200);
    return true;
  }

  button.click(); // close it if no valid options
  return false;
}

function fillField(name, value) {
  let el = document.querySelector(`input[name="${name}"], select[name="${name}"], textarea[name="${name}"]`);
  if (!el) el = document.getElementById(name);

  if (el) {
    if (el.tagName.toLowerCase() === 'select') {
      const options = Array.from(el.querySelectorAll('option'));
      const validOptions = options.filter(opt => !opt.disabled && opt.value && opt.value.trim() !== "");
      if (validOptions.length > 0) {
        const randomOpt = validOptions[Math.floor(Math.random() * validOptions.length)];
        setReactInputValue(el, randomOpt.value);
        return;
      }
    }
    if (el.type === 'checkbox' || el.type === 'radio') {
      setReactInputValue(el, value === true || value === "true");
    } else {
      setReactInputValue(el, value);
    }
  }
}

async function fillButtonGroupByLabel(labelText, optionText) {
  const labels = Array.from(document.querySelectorAll('label'));
  const targetLabel = labels.find(l => {
    const text = l.textContent.replace('*', '').trim().toUpperCase();
    return text === labelText.toUpperCase() || text.startsWith(labelText.toUpperCase());
  });

  if (!targetLabel) return false;

  const container = targetLabel.parentElement;
  if (!container) return false;

  const buttons = Array.from(container.querySelectorAll('button'));
  if (buttons.length === 0) return false;

  const targetButton = buttons.find(b => b.textContent.trim().toUpperCase() === String(optionText).toUpperCase());
  if (targetButton) {
    targetButton.click();
    return true;
  }
  return false;
}

async function fillAllFields(data) {
  // 1. Fill standard inputs
  for (const [key, value] of Object.entries(data)) {
    fillField(key, value);
  }

  // 2. Automate custom React Comboboxes (Shadcn/Radix)
  await fillRadixComboboxByLabel("Mother Tongue", "Hiligaynon");
  await fillRadixComboboxByLabel("Suffix (Extension)", "None"); // Standardize so we don't pick weird ones

  // Address Selector (Ordered: Region -> Province -> City -> Barangay)
  await fillRadixComboboxByLabel("Region");
  await wait(500); // Give API/React time to fetch provinces
  await fillRadixComboboxByLabel("Province");
  await wait(500);
  await fillRadixComboboxByLabel("City / Municipality");
  await wait(500);
  await fillRadixComboboxByLabel("Barangay");

  // Previous School
  await fillRadixComboboxByLabel("School Year Last Attended");

  // 3. Automate Button Groups
  await fillButtonGroupByLabel("Sex", data.sex);
  if (data.underSpecialScienceCurriculum !== undefined) {
    await fillButtonGroupByLabel("Under Special Science Curriculum", data.underSpecialScienceCurriculum ? "YES" : "NO");
  }
}

const actions = {
  FILL_EARLY_REGISTRATION: async () => {
    const data = generateMockData();
    await fillAllFields(data);
    return "Early Registration form dynamically filled!";
  },
  FILL_SCP_ADMISSION: async () => {
    const data = generateMockData();
    await fillAllFields(data);
    return "SCP Admission form dynamically filled!";
  },
  FILL_ENROLLMENT: async () => {
    const data = generateMockData();
    await fillAllFields(data);
    return "Enrollment form dynamically filled!";
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action && actions[request.action]) {
    actions[request.action]()
      .then(message => sendResponse({ success: true, message }))
      .catch(err => {
        console.error(err);
        sendResponse({ success: false, message: err.message });
      });
    return true; // Keep message channel open for async
  }
});
