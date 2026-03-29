import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { verifyPin } from './portal-pin.service.js';
import { normalizeDateToUtcNoon } from '../school-year/school-year.service.js';

/**
 * Lookup learner records using LRN, Birthdate, and PIN.
 * POST /api/learner/lookup
 */
export const lookupLearner = async (req: Request, res: Response) => {
	try {
		const { lrn, birthDate, pin } = req.body;

		if (!lrn || !birthDate || !pin) {
			return res.status(400).json({
				message:
					'The information you entered did not match our records. Please check your LRN, Date of Birth, and PIN.',
			});
		}

		// 1. Find the applicant by LRN and Birth Date
		const applicant = await prisma.applicant.findFirst({
			where: {
				lrn: lrn,
				birthDate: normalizeDateToUtcNoon(new Date(birthDate)),
			},
			include: {
				gradeLevel: true,
				strand: true,
				schoolYear: true,
				addresses: true,
				familyMembers: true,
				enrollment: {
					include: {
						section: {
							include: {
								advisingTeacher: {
									select: {
										firstName: true,
										lastName: true,
										middleName: true,
									},
								},
							},
						},
					},
				},
				healthRecords: {
					include: {
						schoolYear: {
							select: { yearLabel: true },
						},
					},
					orderBy: { assessmentDate: 'desc' },
				},
			},
		});

		// 2. Generic error if not found (don't reveal which factor failed)
		if (!applicant) {
			return res.status(404).json({
				message:
					'The information you entered did not match our records. Please check your LRN, Date of Birth, and PIN.',
			});
		}

		// 3. Check status - only ENROLLED can access
		if (applicant.status !== 'ENROLLED') {
			return res.status(403).json({
				message:
					'Your enrollment is not yet finalized. The portal will be available once your enrollment is confirmed.',
			});
		}

		// 4. Verify PIN
		if (!applicant.portalPin) {
			// Should not happen if status is ENROLLED, but safety first
			return res.status(403).json({
				message:
					'Your enrollment is not yet finalized. The portal will be available once your enrollment is confirmed.',
			});
		}

		const isPinValid = await verifyPin(pin, applicant.portalPin);
		if (!isPinValid) {
			return res.status(401).json({
				message:
					'The information you entered did not match our records. Please check your LRN, Date of Birth, and PIN.',
			});
		}

		// 5. Success! Filter out SPI and internal fields
		const {
			portalPin,
			portalPinChangedAt,
			isIpCommunity,
			ipGroupName,
			is4PsBeneficiary,
			householdId4Ps,
			isLearnerWithDisability,
			disabilityTypes,
			trackingNumber,
			admissionChannel,
			rejectionReason,
			encodedById,
			isPrivacyConsentGiven,
			familyMembers,
			...allowedData
		} = applicant;

		// Filter guardian contact numbers from family members
		const filteredFamilyMembers =
			familyMembers?.map(({ contactNumber, ...rest }) => rest) || [];

		const learner = {
			...allowedData,
			familyMembers: filteredFamilyMembers,
			// Map health records to match the expected format
			healthRecords: applicant.healthRecords.map((hr) => ({
				id: hr.id,
				schoolYear: hr.schoolYear.yearLabel,
				assessmentPeriod: hr.assessmentPeriod,
				assessmentDate: hr.assessmentDate,
				weightKg: hr.weightKg,
				heightCm: hr.heightCm,
				notes: hr.notes,
				createdAt: hr.createdAt,
			})),
		};

		res.json({ learner });
	} catch (error) {
		console.error('Error in learner portal lookup:', error);
		res.status(500).json({
			message: 'An unexpected error occurred. Please try again later.',
		});
	}
};
