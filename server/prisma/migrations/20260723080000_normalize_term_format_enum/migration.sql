-- Align the legacy initial migration with the current mapped Prisma enum.
ALTER TYPE "TermFormat" RENAME VALUE 'TRIMESTERS' TO 'TRIMESTER';
ALTER TYPE "TermFormat" RENAME TO "term_format";
