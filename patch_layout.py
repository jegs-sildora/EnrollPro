import sys
import re

file_path = "client/src/features/learner/pages/Dashboard.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Main Grid Layout
content = content.replace(
    '<div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 gap-6">',
    '<div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">'
)

# 2. Left Column Layout
# Replace the wrapper and remove the Card inside
old_left_col = """            <div className="w-full lg:col-span-4 xl:col-span-3 space-y-6">
              
              {/* Enhanced Learner Identity Card */}
              <Card className="rounded-sm border bg-card shadow-sm overflow-hidden print:shadow-none print:border-border">
                <CardHeader className="bg-transparent p-5 pb-0 print:bg-transparent">
                  <div className="border-b-2 border-gray-100 pb-4 mb-5 flex items-center gap-3 dark:border-border">
                    <User className="h-6 w-6 text-red-800 dark:text-red-700" />
                    <CardTitle className="text-lg font-bold text-foreground uppercase tracking-wide">
                      Official Learner Information
                    </CardTitle>
                  </div>
                </CardHeader>
                <div className="p-5 pt-0 space-y-6">"""

new_left_col = """            <div className="relative lg:sticky lg:top-24 w-full lg:col-span-4 xl:col-span-3 bg-white border border-gray-200 rounded-sm shadow-sm p-5 space-y-6 dark:bg-card dark:border-border">
              {/* Enhanced Learner Identity Card */}
              <div>
                <div className="bg-transparent pb-0 print:bg-transparent">
                  <div className="border-b-2 border-gray-100 pb-4 mb-5 flex items-center gap-3 dark:border-border">
                    <User className="h-6 w-6 text-red-800 dark:text-red-700" />
                    <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">
                      Official Learner Information
                    </h3>
                  </div>
                </div>
                <div className="pt-0 space-y-6">"""

content = content.replace(old_left_col, new_left_col)

# Close the left col by removing the </Card> tag.
# We will just replace `</Card>` after the general average section.
old_left_col_end = """                  </div>
                </div>
              </Card>

              {/* Action Callout */}"""

new_left_col_end = """                  </div>
                </div>
              </div>

              {/* Action Callout */}"""

content = content.replace(old_left_col_end, new_left_col_end)

# 3. Right Column Layout
old_right_col = """            <div className="w-full lg:col-span-8 xl:col-span-9 space-y-6">
              
              {/* Section 3: The Digital SF9 */}
              <Card className="rounded-sm border bg-card shadow-sm overflow-hidden print:shadow-none print:border-border">
                <CardHeader className="bg-transparent p-5 pb-0 print:bg-transparent">
                  <div className="border-b-2 border-gray-100 pb-4 mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between dark:border-border">
                    <div className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-red-800 dark:text-red-700 shrink-0" />
                      <div>
                        <CardTitle className="text-lg font-bold text-foreground uppercase tracking-wide">
                          Official School Form 9 (SF9) - Historical Academic Records
                        </CardTitle>"""

new_right_col = """            <div className="w-full lg:col-span-8 xl:col-span-9 bg-white border border-gray-200 rounded-sm shadow-sm divide-y divide-gray-200 dark:bg-card dark:border-border dark:divide-border">
              
              {/* Section 3: The Digital SF9 */}
              <div className="print:break-inside-avoid">
                <div className="bg-transparent p-5 pb-0 print:bg-transparent">
                  <div className="border-b-2 border-gray-100 pb-4 mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between dark:border-border">
                    <div className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-red-800 dark:text-red-700 shrink-0" />
                      <div>
                        <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">
                          Official School Form 9 (SF9) - Historical Academic Records
                        </h3>"""

content = content.replace(old_right_col, new_right_col)

# Fix SF9 </CardTitle> and </CardHeader>
old_sf9_header_end = """                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 font-bold hidden sm:flex">
                      <FileText className="h-4 w-4 mr-2" /> Download Official SF9
                    </Button>
                  </div>
                </CardHeader>
                <div className="p-5 pt-0">"""

new_sf9_header_end = """                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 font-bold hidden sm:flex">
                      <FileText className="h-4 w-4 mr-2" /> Download Official SF9
                    </Button>
                  </div>
                </div>
                <div className="p-5 pt-0 pb-8">"""

content = content.replace(old_sf9_header_end, new_sf9_header_end)

# Transition between SF9 and SF1
old_transition = """                  )}
                </div>
              </Card>

              {/* Section 4: The Learner Profile (SF1) */}
              <Card className="rounded-sm border bg-card shadow-sm overflow-hidden print:shadow-none print:border-border print:break-inside-avoid">
                <CardHeader className="bg-transparent p-5 pb-0 print:bg-transparent">
                  <div className="border-b-2 border-gray-100 pb-4 mb-5 flex items-center gap-3 dark:border-border">
                    <User className="h-6 w-6 text-red-800 dark:text-red-700 shrink-0" />
                    <CardTitle className="text-lg font-bold text-foreground uppercase tracking-wide">
                      Official Learner Profile (for SF1 Reporting)
                    </CardTitle>
                  </div>
                </CardHeader>
                <div className="p-5 space-y-4">"""

new_transition = """                  )}
                </div>
              </div>

              {/* Section 4: The Learner Profile (SF1) */}
              <div className="print:break-inside-avoid">
                <div className="bg-transparent p-5 pb-0 print:bg-transparent">
                  <div className="border-b-2 border-gray-100 pb-4 mb-5 flex items-center gap-3 dark:border-border">
                    <User className="h-6 w-6 text-red-800 dark:text-red-700 shrink-0" />
                    <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">
                      Official Learner Profile (for SF1 Reporting)
                    </h3>
                  </div>
                </div>
                <div className="p-5 space-y-4">"""

content = content.replace(old_transition, new_transition)

# End of SF1, removing the </Card> tag and tweaking the Sub-Section 4 class
old_end_sf1 = """                {/* Sub-Section 4: Official Correction Procedure */}
                <div className="bg-warning/10 border-t border-warning/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">"""

new_end_sf1 = """                {/* Sub-Section 4: Official Correction Procedure */}
                <div className="bg-warning/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">"""

content = content.replace(old_end_sf1, new_end_sf1)

# Remove the final </Card>
old_final = """                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}"""

new_final = """                  </div>
                </div>
              </div>
            </div>
          </div>
        )}"""

content = content.replace(old_final, new_final)

# Also need to remove the wrapper `<main className="mx-auto max-w-7xl px-4 py-6 print:p-0 print:max-w-none relative z-10">` inner `div` that had the old grid layout.
# Wait, I already replaced:
# `<div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 gap-6">`
# with:
# `<div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">`
# But if it's already inside `<main className="mx-auto max-w-7xl px-4 py-6">`, this will double the container width constraint and padding.
# Let's fix that main wrapper:
old_main = """      <main className="mx-auto max-w-7xl px-4 py-6 print:p-0 print:max-w-none relative z-10">
        {error && ("""

new_main = """      <main className="relative z-10 print:p-0">
        {error && ("""
content = content.replace(old_main, new_main)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Split-Pane Ledger Layout Refactor Complete.")
