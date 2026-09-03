-- CreateTable
CREATE TABLE "_DepartmentTeachers" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_DepartmentTeachers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DepartmentTeachers_B_index" ON "_DepartmentTeachers"("B");

-- AddForeignKey
ALTER TABLE "_DepartmentTeachers" ADD CONSTRAINT "_DepartmentTeachers_A_fkey" FOREIGN KEY ("A") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentTeachers" ADD CONSTRAINT "_DepartmentTeachers_B_fkey" FOREIGN KEY ("B") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate data
INSERT INTO "_DepartmentTeachers" ("A", "B")
SELECT "department_id", "id" FROM "teachers" WHERE "department_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "teachers" DROP CONSTRAINT "teachers_department_id_fkey";

-- AlterTable
ALTER TABLE "teachers" DROP COLUMN "department_id";
