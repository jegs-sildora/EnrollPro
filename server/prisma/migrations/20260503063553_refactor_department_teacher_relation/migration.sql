/*
  Warnings:

  - You are about to drop the column `department` on the `teachers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[head_id]` on the table `departments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "head_id" INTEGER;

-- AlterTable
ALTER TABLE "teachers" DROP COLUMN "department",
ADD COLUMN     "department_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "uq_departments_head_id" ON "departments"("head_id");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
