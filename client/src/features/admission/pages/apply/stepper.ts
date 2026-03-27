import { defineStepper } from "@stepperize/react";

export const { useStepper, steps, Stepper } = defineStepper(
  {
    id: "personal",
    title: "Personal Information",
    description: "Basic details & reference numbers",
  },
  {
    id: "family",
    title: "Family & Contact",
    description: "Who do we contact?",
  },
  { id: "background", title: "Background", description: "A few more details" },
  {
    id: "previousSchool",
    title: "Previous School",
    description: "Where did you study last?",
  },
  {
    id: "preferences",
    title: "Preferences",
    description: "What are you applying for?",
  },
  {
    id: "review",
    title: "Review & Submit",
    description: "Check everything before submitting",
  },
);
