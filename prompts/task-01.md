Act as a Senior UI/UX Engineer.

MISSION: Transform LRN Collision Error into an Interactive Recovery Module
The current LRN validation throws a static red error banner that creates a UX dead-end for users trying to correct previous submissions. You must intercept this collision early and provide an actionable pathway to securely fetch and update their existing data, or bypass it as a flagged new submission.

Execute the following layout and logic mandates exactly:

TASK 1: The onBlur LRN Check

Trigger a lightweight backend query when the user clicks out of the LRN input field (onBlur) to check if a pending application already exists for that 12-digit number.

If a collision is detected, remove the red error banner.

TASK 2: Render the Actionable Recovery Block

If a collision is found, dynamically render a prominent Info Block (use a primary blue or neutral gray tint, NOT an error red) directly below the LRN input.

Header Text: "An active application was found for this LRN."

TASK 3: Implement Recovery Actions
Inside this Info Block, provide two distinct user paths:

Path A (The Update Flow): * Display a text input: "To update your information, enter your original Tracking Number."

Provide a "Fetch Data" button next to it.

Logic: If the tracking number matches, populate all form fields below with their existing database payload so the user only has to edit the specific fields they want to change.

Path B (The Bypass Flow):

Display a subtle text link or secondary button below Path A: "Lost your tracking number? Proceed with a new submission."

Logic: Clicking this dismisses the Info Block, allowing the user to fill out a blank form normally (which the backend will later flag as a duplicate).