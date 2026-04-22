import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Step {
  title: string;
  description: string;
  stats?: Record<string, any>;
}

interface ProposedAssignment {
  applicationId: number;
  sectionId: number;
  sectionName: string;
  learnerName: string;
  lrn: string | null;
  gender: string | null;
  genAve: number | null;
  readingProfile: string | null;
  programType: string;
}

interface SectioningPreview {
  schoolYearLabel: string;
  gradeLevelName: string;
  steps: Step[];
  proposedAssignments: ProposedAssignment[];
}

interface SectioningState {
  previewData: SectioningPreview | null;
  modifiedAssignments: ProposedAssignment[];
  gradeLevelId: number | null;
  schoolYearId: number | null;
  isBatchPending: boolean;
  
  setBatchData: (
    previewData: SectioningPreview, 
    modifiedAssignments: ProposedAssignment[],
    gradeLevelId: number,
    schoolYearId: number
  ) => void;
  updateModifiedAssignments: (assignments: ProposedAssignment[]) => void;
  updateLearnerSection: (applicationId: number, sectionId: number, sectionName: string) => void;
  clearBatch: () => void;
}

export const useSectioningStore = create<SectioningState>()(
  persist(
    (set) => ({
      previewData: null,
      modifiedAssignments: [],
      gradeLevelId: null,
      schoolYearId: null,
      isBatchPending: false,

      setBatchData: (previewData, modifiedAssignments, gradeLevelId, schoolYearId) => set({
        previewData,
        modifiedAssignments,
        gradeLevelId,
        schoolYearId,
        isBatchPending: true
      }),

      updateModifiedAssignments: (modifiedAssignments) => set({ modifiedAssignments }),

      updateLearnerSection: (applicationId, sectionId, sectionName) => set((state) => ({
        modifiedAssignments: state.modifiedAssignments.map(a => 
          a.applicationId === applicationId 
            ? { ...a, sectionId, sectionName } 
            : a
        )
      })),

      clearBatch: () => set({
        previewData: null,
        modifiedAssignments: [],
        gradeLevelId: null,
        schoolYearId: null,
        isBatchPending: false
      })
    }),
    {
      name: 'enrollpro-sectioning'
    }
  )
);
