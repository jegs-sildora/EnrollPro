# Prompt for Backend Fix: Automated Sectioning Engine - Cohort Ranking & Balancing

## Role & Context
Act as a Backend Developer. We are fixing a logical failure in the `Automated Sectioning Engine` for EnrollPro. 

The engine currently fails to properly identify top learners for the `TOP BEC` sections and is dumping all learners into the regular sections. We need to implement a true cohort-ranking algorithm that fills the Top BEC section(s) with the highest-ranking learners, and then rigorously balances the remaining learners across regular sections based on both Academic Performance (Gen Ave) and Sex.

## Diagnostic Checklist
Before rewriting the logic, check for this common error:
1.  **Rogue Capacity Constraints:** Ensure there are no conditional checks (e.g., `if total_learners >= 40`) blocking the execution of the Top BEC logic. The engine must attempt to isolate the top learners even if the testing database only has a handful of enrolled students.

## Bulletproof Algorithmic Implementation

Please rewrite the sectioning controller using the following strict sequential logic flow. Do not use code snippets; implement this architectural logic in your backend language:

### Step 1: Database Setup & Query Split
1. Fetch the system configuration. If the `Enable Top BEC Sections` flag is FALSE, skip immediately to Step 3 (Regular Section Draft).
2. Fetch all sections for the targeted Grade Level.
3. Split these sections into two distinct lists: 
   * `Top Sections` (filtered by the top section database flag).
   * `Regular Sections` (the remaining sections).
4. Calculate the `Total Top Capacity` (e.g., if there is 1 Top Section with a capacity of 40, the total capacity is 40).

### Step 2: Cohort Ranking & Top BEC Fill
Instead of a hardcoded grade threshold, we evaluate the learners relative to their cohort.
1. Fetch the pool of all `Ready for Sectioning` learners.
2. Sort the entire pool in strictly **descending** order based on their `Final Gen Ave`.
3. Filter out any learners with a `Conditionally Promoted` status (back subjects are generally disqualified from Pilot sections, regardless of Gen Ave).
4. **The Slice:** From this sorted, filtered list, extract the top $N$ learners, where $N$ is equal to the `Total Top Capacity` calculated in Step 1. 
5. Distribute these top learners into the `Top Sections`.
6. **Crucial:** Remove these assigned top learners from the master pool so they are not drafted again in Step 3.

### Step 3: Heterogeneous Balancing (Gen Ave + Sex)
Take the *remaining* unassigned learners in the master pool. To ensure the regular sections are perfectly balanced by both academic weight and gender ratio, execute the following:
1. **Split by Sex:** Divide the remaining master pool into two separate arrays: `Male Learners` and `Female Learners`.
2. **Verify Sorting:** Ensure both arrays are still sorted descending by `Final Gen Ave`.
3. **Male Snake Draft:** Execute a serpentine distribution (snake draft) of the `Male Learners` across all available `Regular Sections` (e.g., Section A -> Section B -> Section C -> Section C -> Section B -> Section A).
4. **Female Snake Draft:** Execute the same serpentine distribution for the `Female Learners` across the `Regular Sections`, picking up exactly where the section index left off.

## Expected Output for Testing
Using a test payload with 2 learners:
*   **Learner A (Gen Ave: 88.00):** As the highest-ranking learner in the cohort, they must be extracted and placed in `LUNA (TOP BEC)`.
*   **Learner B (Gen Ave: 69.00):** As the remaining lower-ranking learner, they bypass the filled/assigned Top section and are placed into the `AGUINALDO (Regular)` snake draft.