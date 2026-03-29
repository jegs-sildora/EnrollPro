import { defineStepper } from '@stepperize/react';
import type { StepperReturn } from '@stepperize/react';
import type { Metadata, StepStatus, Stepper as StepperCore } from '@stepperize/core';

const stepper = defineStepper(
	{
		id: 'personal',
		title: 'Personal Information',
		description: 'Basic details & reference numbers',
	},
	{
		id: 'family',
		title: 'Family & Contact',
		description: 'Who do we contact?',
	},
	{ id: 'background', title: 'Background', description: 'A few more details' },
	{
		id: 'previousSchool',
		title: 'Previous School',
		description: 'Where did you study last?',
	},
	{
		id: 'preferences',
		title: 'Preferences',
		description: 'What are you applying for?',
	},
	{
		id: 'review',
		title: 'Review & Submit',
		description: 'Check everything before submitting',
	},
);

type MySteps = typeof stepper.steps;

export const useStepper: StepperReturn<MySteps>['useStepper'] = stepper.useStepper;
export const steps: MySteps = stepper.steps;
export const Stepper: StepperReturn<MySteps>['Stepper'] = stepper.Stepper;
export const Scoped: StepperReturn<MySteps>['Scoped'] = stepper.Scoped;

// Re-export types to satisfy portability and ensure they are reachable if needed
export type { Metadata, StepStatus, StepperCore };
