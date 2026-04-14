import { defineStepper } from "@stepperize/react";
import type { StepperReturn } from "@stepperize/react";
import type {
  Metadata,
  StepStatus,
  Stepper as StepperCore,
} from "@stepperize/core";

const stepper = defineStepper(
  {
    id: "basic-info",
    title: "Basic & Application Information",
    description:
      "School year, learner category, grade level, LRN, and application track",
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

type MySteps = typeof stepper.steps;

export const useStepper: StepperReturn<MySteps>["useStepper"] =
  stepper.useStepper;
export const steps: MySteps = stepper.steps;
export const Stepper: StepperReturn<MySteps>["Stepper"] = stepper.Stepper;
export const Scoped: StepperReturn<MySteps>["Scoped"] = stepper.Scoped;

// Re-export types to satisfy portability and ensure they are reachable if needed
export type { Metadata, StepStatus, StepperCore };
