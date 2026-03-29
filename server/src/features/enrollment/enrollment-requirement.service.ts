import { LearnerType, ApplicantType } from '@prisma/client';

export interface EnrollmentRequirement {
	type: string;
	label: string;
	isRequired: boolean;
	isOnceOnly: boolean;
	description: string;
	phase: 1 | 2;
}

/**
 * Determines the mandatory documentary requirements based on DO 017, s. 2025.
 */
export function getRequiredDocuments(params: {
	learnerType: LearnerType;
	gradeLevel: string;
	applicantType: ApplicantType;
	isLwd: boolean;
	isPeptAePasser?: boolean;
}) {
	const { learnerType, gradeLevel, applicantType, isLwd, isPeptAePasser } =
		params;
	const requirements: EnrollmentRequirement[] = [];

	// 1. Basic Education Enrollment Form (BEEF) - Required for all new/transferee/returning in Phase 2
	if (learnerType !== 'CONTINUING') {
		requirements.push({
			type: 'BEEF',
			label: 'Basic Education Enrollment Form (BEEF)',
			isRequired: true,
			isOnceOnly: false,
			description: 'Official DepEd enrollment form',
			phase: 2,
		});
	} else {
		// Continuing learners only need Confirmation Slip
		requirements.push({
			type: 'CONFIRMATION_SLIP',
			label: 'Enrollment Confirmation Slip (Annex C)',
			isRequired: true,
			isOnceOnly: false,
			description: 'Simple form confirming intent to continue',
			phase: 2,
		});
	}

	// 2. PSA Birth Certificate - Rule 1: Submitted once per school
	if (learnerType !== 'CONTINUING') {
		requirements.push({
			type: 'PSA_BIRTH_CERTIFICATE',
			label: 'PSA Birth Certificate',
			isRequired: true,
			isOnceOnly: true,
			description:
				'Required once per school stay. Secondary proof accepted if unavailable.',
			phase: 1,
		});
	}

	// 3. school records (SF9 / Report Card)
	if (learnerType === 'NEW_ENROLLEE') {
		const prevGrade = gradeLevel === '7' ? '6' : '10';
		requirements.push({
			type: 'SF9_REPORT_CARD',
			label: `SF9 (Grade ${prevGrade} Report Card)`,
			isRequired: true,
			isOnceOnly: false,
			description: `Proof of Grade ${prevGrade} completion`,
			phase: 1,
		});
	} else if (learnerType === 'TRANSFEREE') {
		requirements.push({
			type: 'SF9_REPORT_CARD',
			label: 'Most Recent SF9 (Report Card)',
			isRequired: true,
			isOnceOnly: false,
			description: 'From previous school',
			phase: 1,
		});
	} else if (learnerType === 'RETURNING') {
		requirements.push({
			type: 'ACADEMIC_RECORD',
			label: 'Most Recent Academic Record',
			isRequired: true,
			isOnceOnly: false,
			description:
				'SF9, certification, or any prior record (flexible for Balik-Aral)',
			phase: 1,
		});
	}

	// 4. PEPT / A&E Certificate
	if (isPeptAePasser) {
		requirements.push({
			type: 'PEPT_AE_CERTIFICATE',
			label: 'PEPT/A&E Certificate of Rating',
			isRequired: true,
			isOnceOnly: false,
			description: 'Required for PEPT/A&E passers',
			phase: 1,
		});
	}

	// 5. LWD Requirements
	if (isLwd) {
		requirements.push({
			type: 'PWD_ID',
			label: 'PWD ID',
			isRequired: false, // Optional but encouraged
			isOnceOnly: false,
			description: 'If available, for support services',
			phase: 2,
		});
		requirements.push({
			type: 'MEDICAL_EVALUATION',
			label: 'Medical Evaluation/Diagnosis',
			isRequired: false, // Optional but encouraged
			isOnceOnly: false,
			description: 'From a Licensed Medical Specialist',
			phase: 2,
		});
	}

	// 6. Transferee specific: Affidavit of Undertaking
	if (learnerType === 'TRANSFEREE') {
		requirements.push({
			type: 'AFFIDAVIT_OF_UNDERTAKING',
			label: 'Affidavit of Undertaking',
			isRequired: false, // Only if unpaid fees at private school
			isOnceOnly: false,
			description:
				'Required only if there are unpaid fees at the previous private school',
			phase: 2,
		});
	}

	return requirements;
}
