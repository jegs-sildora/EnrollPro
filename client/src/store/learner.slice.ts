import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LearnerProfile } from '@/features/learner/types';

interface LearnerState {
	learner: LearnerProfile | null;
	setLearner: (learner: LearnerProfile | null) => void;
	logout: () => void;
}

export const useLearnerStore = create<LearnerState>()(
	persist(
		(set) => ({
			learner: null,
			setLearner: (learner) => set({ learner }),
			logout: () => set({ learner: null }),
		}),
		{
			name: 'enrollpro-learner-session',
		},
	),
);
