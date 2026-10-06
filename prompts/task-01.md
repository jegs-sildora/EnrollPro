# System Prompt: Implement Dynamic Randomization for QA Autofill Extension

**Role:** Senior Web Extension Developer & QA Automation Expert

## Context
We are refactoring the `content.js` script of our Firefox QA Autofill Extension[cite: 27]. The initial implementation relied on a hardcoded `MOCK_DATA` object, which injects the exact same data (e.g., "Juan Miguel Dela Cruz") every time the user clicks a fill button[cite: 27]. 

For effective QA testing of the "EnrollPro" system, the extension must generate highly realistic, randomized Philippine data on the fly, **every single time a button is clicked**. Additionally, we observed that dropdown menus (e.g., "Mother Tongue" or "Suffix" shown in the UI[cite: 31]) require special handling to ensure the script selects a valid `<option>` rather than failing or selecting a disabled placeholder.

## Task
Rewrite the `content.js` file to replace the static `MOCK_DATA` object with a dynamic data factory[cite: 27]. Implement custom randomizer functions using comprehensive Philippine data dictionaries and ensure seamless interaction with React-controlled `<select>` dropdowns.

## Design & Logic Constraints (CRITICAL)

### 1. The Dynamic Data Factory
*   **Remove Static Object:** Delete the `const MOCK_DATA = {...}` object entirely[cite: 27].
*   **Create Data Dictionaries:** Define robust arrays for Philippine demographics at the top of the script:
    *   `phFirstNamesMale`: ["Juan Miguel", "Jose", "Pedro", "Carlo", "Mark"]
    *   `phFirstNamesFemale`: ["Maria", "Ana", "Luz", "Teresa", "Sofia"]
    *   `phLastNames`: ["Dela Cruz", "Santos", "Reyes", "Aquino", "Garcia", "Mendoza"]
    *   `phBarangays`: ["Brgy. Taculing", "Brgy. Estefania", "Brgy. Mansilingan", "Brgy. Villamonte", "Brgy. Bata"]
    *   `phCities`: ["Bacolod City", "Talisay City", "Silay City", "Bago City"]
*   **Implement `generateMockData()`:** Create a function that constructs and returns a fresh data object on every invocation. 
    *   *LRN:* Generate a random 12-digit string starting with "1".
    *   *Contact Number:* Generate a random 11-digit string starting with "09".
    *   *Grades:* Generate a random float between `80.00` and `98.00`.
    *   *Demographics:* Randomly select a sex (Male/Female) and pull a corresponding first name and a random last name.

### 2. Advanced Dropdown & Select Handling
React Hook Form and standard HTML `<select>` elements require specific targeting. The current `fillField` function[cite: 27] must be upgraded to handle dynamic dropdown values.
*   **Targeting Valid Options:** If the target element is a `<select>`, the script should NOT blindly inject a string that might not exist in the DOM.
*   **Logic:** 
    1. Query the `<select>` element.
    2. Extract all its child `<option>` elements.
    3. Filter out options that are disabled or have empty values (e.g., "SELECT MOTHER TONGUE"[cite: 31]).
    4. Pick a random valid `<option>.value` from the remaining list.
    5. Pass that selected value into the existing `setReactInputValue` bypass function[cite: 27].

### 3. Action Execution Update
*   Update the `actions` object (`FILL_EARLY_REGISTRATION`, `FILL_SCP_ADMISSION`, `FILL_ENROLLMENT`)[cite: 27] to execute `generateMockData()` first, and then pass the freshly generated payload to the `fillAllFields(data)` function.

## Output Requirement
Output the complete, refactored raw code for `content.js`. Do not generate the manifest or popup files, as those remain unchanged. Ensure the data dictionaries contain at least 5-10 realistic items each to ensure visible variety during QA testing, and heavily comment the `<select>` randomization logic so junior developers understand how it integrates with the React Native Setter Bypass.