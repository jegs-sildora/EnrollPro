import re
from pathlib import Path

BOSY_PAGE = r'c:\Users\localhost\Documents\Enrollpro\client\src\features\bosy\pages\BOSYPage.tsx'

with open(BOSY_PAGE, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Title and Subtitle, and replace "Live Sync" badge
content = content.replace(
    '''<h1 className="text-3xl font-bold">Early Registration (BOSY)</h1>
          <p className="text-base leading-tight font-bold">
            Verify Learner Reference Numbers (LRN) and confirm intent to enroll for returning Junior High School learners.
          </p>''',
    '''<h1 className="text-3xl font-bold">Confirmation of Continuing Learners</h1>
          <p className="text-base leading-tight font-bold">
            Verify returning Junior High School learners and roll their records over to the live S.Y. 2026–2027 masterlist.
          </p>'''
)

content = re.sub(
    r'<div\s+className=\{cn\(\s*"inline-flex items-center gap-1\.5 rounded-full border px-2\.5 py-1 text-\[11px\] font-bold",\s*isUserInteracting\s*\?\s*"border-muted-foreground/30 text-foreground"\s*:\s*"border-emerald-200 text-emerald-700",\s*\)\}\s*>\s*<span\s+className=\{cn\(\s*"size-2 rounded-full",\s*isUserInteracting\s*\?\s*"bg-muted-foreground/60"\s*:\s*"bg-emerald-500 animate-pulse",\s*\)\}\s*/>\s*\{isUserInteracting \? "Paused" : "Live Sync"\}\s*</div>',
    '''<div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
              "border-emerald-200 text-emerald-700 bg-emerald-50"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full bg-emerald-500"
              )}
            />
            Local Staging: Active
          </div>''',
    content,
    flags=re.MULTILINE
)

# Remove "Refresh Data" action button
content = re.sub(
    r'<Button\s*variant="outline"\s*size="sm"\s*onClick=\{fetchQueue\}\s*disabled=\{loading\}\s*className="h-7 text-xs px-2"\s*>\s*<RefreshCw\s*className=\{cn\("h-3.5 w-3.5 mr-1",\s*loading && "animate-spin"\)\}\s*/>\s*Refresh Data\s*</Button>',
    '',
    content,
    flags=re.MULTILINE
)

# 2. Update Triage Metric Cards (Row 1)
content = re.sub(
    r'icon: AlertCircle,\s*label: "Pending Confirmation",\s*value: readiness\?\.pendingConfirmationCount \?\? 0,\s*filterVal: "PENDING_VERIFICATION",',
    '''icon: AlertCircle,
            label: "To Review & Confirm",
            subBadge: "Returning JHS Enrollees",
            value: readiness?.pendingConfirmationCount ?? 0,
            filterVal: "PENDING_VERIFICATION",
            amber: true,''',
    content
)
content = re.sub(
    r'icon: CheckCircle2,\s*label: "Confirmed \(Returning\)",\s*value: readiness\?\.readyForSectioningCount \?\? 0,\s*filterVal: "READY_FOR_SECTIONING",',
    '''icon: CheckCircle2,
            label: "Successfully Rolled Over",
            subBadge: "Appended to Official BOSY Tally",
            value: readiness?.readyForSectioningCount ?? 0,
            filterVal: "READY_FOR_SECTIONING",
            amber: false,''',
    content
)
content = re.sub(
    r'icon: LogOut,\s*label: "Transferred / Dropped",\s*value: readiness\?\.droppedCount \?\? 0,\s*filterVal: "TRANSFERRED_OUT",',
    '''icon: LogOut,
            label: "Moved Out / Transferred",
            subBadge: "Requested Form 137 (SF10)",
            value: readiness?.droppedCount ?? 0,
            filterVal: "TRANSFERRED_OUT",
            amber: false,''',
    content
)

content = re.sub(
    r'\.map\(\(\{ icon: Icon, label, value, filterVal \}\) => \(',
    '.map(({ icon: Icon, label, subBadge, value, filterVal, amber }) => (',
    content
)

content = re.sub(
    r'statusFilter === filterVal\s*\?\s*"border-slate-200 border-l-4 border-l-primary bg-white"\s*:\s*"border-slate-200 bg-white hover:border-primary/50"',
    'statusFilter === filterVal ? (amber ? "border-amber-500 border-l-4 bg-amber-50/20" : "border-slate-200 border-l-4 border-l-primary bg-white") : "border-slate-200 bg-white hover:border-primary/50"',
    content
)

content = re.sub(
    r'statusFilter === filterVal\s*\?\s*"bg-primary/10 text-primary"\s*:\s*"bg-muted text-muted-foreground"',
    'statusFilter === filterVal ? (amber ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary") : (amber ? "bg-amber-50 text-amber-500" : "bg-muted text-muted-foreground")',
    content
)

content = re.sub(
    r'<p className="text-\[10px\] font-black uppercase leading-tight text-foreground">\s*\{label\}\s*</p>',
    '''<p className={cn("text-[10px] font-black uppercase leading-tight", amber ? "text-amber-700" : "text-foreground")}>
                  {label}
                </p>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase">{subBadge}</p>''',
    content
)

content = re.sub(
    r'<p className="text-2xl font-black">\{value\}</p>',
    '''{value === 0 ? (
                <p className="text-xs font-bold text-muted-foreground">✓ All records accounted for</p>
              ) : (
                <p className={cn("text-2xl font-black", amber && "text-amber-600")}>{value}</p>
              )}''',
    content
)

# 3. Add targetGrade state and filter
content = re.sub(
    r'const \[statusFilter, setStatusFilter\] = useState<string>\("PENDING_VERIFICATION"\);',
    'const [statusFilter, setStatusFilter] = useState<string>("PENDING_VERIFICATION");\n  const [targetGrade, setTargetGrade] = useState<string>("ALL");',
    content
)

# Modify fetchQueue to pass gradeLevelId if targetGrade != "ALL"
content = re.sub(
    r'status: statusFilter,\s*search: debouncedSearch,\s*previousSectionName: priorSectionFilter === "ALL" \? undefined : priorSectionFilter,\s*page: queuePage,\s*limit: 20,',
    '''status: statusFilter,
          search: debouncedSearch,
          previousSectionName: priorSectionFilter === "ALL" ? undefined : priorSectionFilter,
          gradeLevelId: targetGrade === "ALL" ? undefined : parseInt(targetGrade, 10),
          page: queuePage,
          limit: 20,''',
    content
)
# Update dependency array of the useEffect
content = content.replace(
    '[activeSy, queuePage, statusFilter, debouncedSearch, priorSectionFilter, fetchQueue]',
    '[activeSy, queuePage, statusFilter, debouncedSearch, priorSectionFilter, targetGrade, fetchQueue]'
)

# 4. Search Bar Width and Dropdowns
content = content.replace(
    'className="relative w-full lg:w-64 shrink-0"',
    'className="relative w-full lg:w-1/2 shrink-0"'
)

content = content.replace(
    'placeholder="Search LRN, First Name, Last Name..."',
    'placeholder="Search by LRN, Last Name, or First Name..."'
)

new_filters = '''<Select
                value={targetGrade}
                onValueChange={(val) => {
                  setTargetGrade(val);
                  setQueuePage(1);
                  setRowSelection({});
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px] bg-white h-9">
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground">Target Grade</span>
                    <SelectValue placeholder="All Returning Grades" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Returning Grades</SelectItem>
                  <SelectItem value="8">Incoming Grade 8</SelectItem>
                  <SelectItem value="9">Incoming Grade 9</SelectItem>
                  <SelectItem value="10">Incoming Grade 10</SelectItem>
                </SelectContent>
              </Select>
'''

content = re.sub(
    r'(<Select\s*value=\{priorSectionFilter\})',
    new_filters + r'\1',
    content
)

# 5. Inject Batch Action Bar
batch_action_bar = '''
        {Object.keys(rowSelection).length > 0 && statusFilter === "PENDING_VERIFICATION" && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-full px-6 py-3 shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
            <span className="text-sm font-bold">
              {Object.keys(rowSelection).length} Returning Learners Selected
            </span>
            <Button
              variant="default"
              size="sm"
              className="bg-white text-slate-900 hover:bg-slate-100 font-bold"
              onClick={() => setBatchConfirmOpen(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Batch-Confirm Selected Learners
            </Button>
          </div>
        )}
'''
content = content.replace(
    '<div className="bg-white rounded-lg border shadow-sm flex flex-col flex-1 min-h-0 relative">',
    batch_action_bar + '\n        <div className="bg-white rounded-lg border shadow-sm flex flex-col flex-1 min-h-0 relative overflow-hidden">'
)

with open(BOSY_PAGE, 'w', encoding='utf-8') as f:
    f.write(content)

print("BOSYPage updated.")
