-- Add the least-privilege application role required by the ATLAS scheduler contract.
ALTER TYPE "user_role" ADD VALUE 'GRADE_LEVEL_COORDINATOR';
