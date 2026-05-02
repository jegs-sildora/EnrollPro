-- CreateTable
CREATE TABLE "rubric_categories" (
    "id" SERIAL NOT NULL,
    "scp_program_step_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rubric_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" SERIAL NOT NULL,
    "rubric_category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_pts" DOUBLE PRECISION NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_rubric_categories_step_id" ON "rubric_categories"("scp_program_step_id");

-- CreateIndex
CREATE INDEX "idx_rubric_criteria_category_id" ON "rubric_criteria"("rubric_category_id");

-- AddForeignKey
ALTER TABLE "rubric_categories" ADD CONSTRAINT "rubric_categories_scp_program_step_id_fkey" FOREIGN KEY ("scp_program_step_id") REFERENCES "scp_program_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_rubric_category_id_fkey" FOREIGN KEY ("rubric_category_id") REFERENCES "rubric_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
