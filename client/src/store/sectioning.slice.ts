import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SectioningParams } from '@enrollpro/shared';

interface Step {
  title: string;
  description: string;
  stats?: {
    assigned?: number;
    steCutoffScore?: number | null;
    pilotCutoffAve?: number | null;
    spillover?: number;
    reclassifiedLearners?: ProposedAssignment[];
    frustratedCount?: number;
    [key: string]: unknown;
  };
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
  status: string;
}

interface SectioningPreview {
  schoolYearLabel: string;
  gradeLevelName: string;
  params: SectioningParams;
  steps: Step[];
  proposedAssignments: ProposedAssignment[];
}

interface SectioningState {
  previewData: SectioningPreview | null;
  modifiedAssignments: ProposedAssignment[];
  gradeLevelId: number | null;
  schoolYearId: number | null;
  sectioningParams: SectioningParams | null;
  isBatchPending: boolean;
  smartSyncStatus: Record<number, boolean>;
  
  setBatchData: (
    previewData: SectioningPreview, 
    modifiedAssignments: ProposedAssignment[],
    gradeLevelId: number,
    schoolYearId: number
  ) => void;
  setSectioningParams: (params: SectioningParams) => void;
  updateModifiedAssignments: (assignments: ProposedAssignment[]) => void;
  updateLearnerSection: (applicationId: number, sectionId: number, sectionName: string) => void;
  clearBatch: () => void;
  setSmartSynced: (gradeLevelId: number, synced: boolean) => void;
}

export const useSectioningStore = create<SectioningState>()(
  persist(
    (set) => ({
      previewData: null,
      modifiedAssignments: [],
      gradeLevelId: null,
      schoolYearId: null,
      sectioningParams: null,
      isBatchPending: false,
      smartSyncStatus: {},

      setBatchData: (previewData, modifiedAssignments, gradeLevelId, schoolYearId) => set({
        previewData,
        modifiedAssignments,
        gradeLevelId,
        schoolYearId,
        isBatchPending: true
      }),

      setSectioningParams: (sectioningParams) => set({ sectioningParams }),

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
        sectioningParams: null,
        isBatchPending: false
      }),

      setSmartSynced: (gradeLevelId, synced) => set((state) => ({
        smartSyncStatus: {
          ...state.smartSyncStatus,
          [gradeLevelId]: synced
        }
      }))
    }),
    {
      name: 'enrollpro-sectioning'
    }
  )
);
