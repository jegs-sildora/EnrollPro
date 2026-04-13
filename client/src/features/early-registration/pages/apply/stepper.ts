import { defineStepper } from "@stepperize/react";

const stepper = defineStepper(
  {
    id: "basic-info",
    title: "Basic Information",
    description: "Grade Level and School Year",
  },
  {
    id: "learner-profile",
    title: "Learner Profile",
    description: "Name, Birthdate, Sex, IP/PWD status",
  },
  {
    id: "address-guardian",
    title: "Address & Guardian",
    description: "Home address and parent/guardian details",
  },
  {
    id: "legal-consent",
    title: "Review & Submit",
    description: "Final check and submission",
  },
);

export const { useStepper, steps } = stepper;
