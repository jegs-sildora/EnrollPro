import sys
import re

file_path = "client/src/features/learner/pages/Dashboard.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Master Container
old_main = """      <main className="relative z-10 print:p-0">
        {error && (
          <div className="p-4 rounded-sm bg-destructive/10 border border-destructive/20 flex items-center gap-3 mb-6">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        {data && (
          <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">"""

new_main = """      <div className="flex flex-col lg:flex-row w-full h-auto lg:h-[calc(100vh-64px)] overflow-hidden bg-gray-50/50 relative z-10 print:h-auto print:overflow-visible">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-4 rounded-sm bg-destructive/10 border border-destructive/20 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        {data && (
          <>"""
content = content.replace(old_main, new_main)

# 2. Left Pane (Sidebar)
old_left = """            {/* Left Column: Personal Performance & Profile at a Glance */}
            <div className="relative lg:sticky lg:top-24 w-full lg:col-span-4 xl:col-span-3 bg-white border border-gray-200 rounded-sm shadow-sm p-5 space-y-6 dark:bg-card dark:border-border">"""

new_left = """            {/* Left Pane (Fixed Identity Sidebar) */}
            <aside className="w-full lg:w-80 flex-shrink-0 h-auto lg:h-full lg:overflow-y-auto bg-white border-b lg:border-b-0 lg:border-r border-gray-200 p-6 shadow-sm dark:bg-card dark:border-border space-y-6 print:w-full print:border-none print:shadow-none">"""
content = content.replace(old_left, new_left)

old_left_close = """              </div>

              {/* Action Callout */}"""

new_left_close = """              </aside>

              {/* Action Callout */}"""
# wait, Action Callout is inside the Left Pane. Let's look at the original code.
# The Action Callout was inside the `div`, wait:
# ```
#              </Card> // this was removed
#              {/* Action Callout */}
#              ...
#            </div> // End of left column
# ```
# If I change `<div className="relative lg:sticky...">` to `<aside>`, I just need to change the closing tag.

