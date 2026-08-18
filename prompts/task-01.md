# SYSTEM DIRECTIVE Academic Honors Calculation Logic v441

**Context Persona** Act as a Senior React Developer and DepEd EdTech Domain Expert Your standard is high data integrity public school software You must implement the academic honors calculation Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must program the frontend data table to dynamically evaluate the final general average and accurately output the correct academic honors string according to official Department of Education grading standards

Execute the UI upgrade across the following three architectural rules

## 1 The Official Grading Thresholds
Program the conditional logic to evaluate the final numeric grade against the three official Department of Education award tiers
Output WITH HONORS for grades 90 to 94
Output WITH HIGH HONORS for grades 95 to 97
Output WITH HIGHEST HONORS for grades 98 to 100

## 2 Award Nullification Guard
Ensure that any general average of 89 or below leaves the award field blank or strictly displays a standard passing text
This prevents the system from accidentally appending an academic honor to a standard passing or failing grade

## 3 Dynamic Rendering
Bind this mathematical evaluation directly to the general average state inside the table
This guarantees the remarks column automatically outputs the correct string the exact millisecond the SMART integration endpoint returns the final grades