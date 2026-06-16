import sys
import re

file_path = "client/src/features/learner/pages/Dashboard.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update interface
content = content.replace(
    "schoolLogoUrl: string | null;\n}",
    "schoolLogoUrl: string | null;\n  active_quarter: number;\n}"
)

# 2. Update Avatar Logic
old_avatar = """<div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-gray-200 rounded-sm border border-gray-300 flex items-center justify-center shrink-0">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>"""

new_avatar = """<div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-red-50 text-red-800 rounded-full border border-red-200 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                      {data.sf1.studentPhoto ? (
                        <img src={data.sf1.studentPhoto} alt="Learner Photo" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-2xl font-black tracking-tighter">
                          {data.identity.firstName.charAt(0)}{data.identity.lastName.charAt(0)}
                        </span>
                      )}
                    </div>"""
content = content.replace(old_avatar, new_avatar)


# 3. Update Progress Tracker Logic
old_progress = """<div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Progress Tracker</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
                        <div key={q} className={`flex flex-col items-center justify-center p-2 rounded-sm border ${i === 0 ? 'bg-primary/10 border-primary text-primary' : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-muted/30 dark:border-border'}`}>
                          <span className="text-xs font-bold">{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>"""

new_progress = """<div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Progress Tracker</h3>
                    <div className="relative flex items-center justify-between w-full px-2">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200 dark:bg-border z-0"></div>
                      {[1, 2, 3, 4].map((q) => {
                        const isCompleted = q < data.active_quarter;
                        const isActive = q === data.active_quarter;
                        
                        let circleClasses = "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ";
                        if (isCompleted) {
                          circleClasses += "bg-red-800 text-white border-2 border-red-800";
                        } else if (isActive) {
                          circleClasses += "bg-white text-red-800 border-2 border-red-800 dark:bg-background";
                        } else {
                          circleClasses += "bg-gray-100 text-gray-400 border border-gray-300 dark:bg-muted dark:border-border";
                        }

                        return (
                          <div key={q} className="flex flex-col items-center gap-1 z-10 bg-white dark:bg-card px-1">
                            <div className={circleClasses}>Q{q}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>"""
content = content.replace(old_progress, new_progress)


# 4. Update General Average Logic
old_average = """<div className="bg-gray-50 border border-gray-200 rounded-sm p-4 flex flex-col items-center justify-center dark:bg-muted/30 dark:border-border">
                    <span className="text-xs font-bold uppercase text-muted-foreground mb-1">Current General Average</span>
                    <span className="text-3xl font-black text-primary">
                      {data.academicHistory?.[0]?.general_average || "—"}
                    </span>
                  </div>"""

new_average = """<div className="bg-gray-50 border border-gray-200 rounded-sm p-4 flex flex-col items-center justify-center dark:bg-muted/30 dark:border-border">
                    <span className="text-xs font-bold uppercase text-muted-foreground mb-1">Current General Average</span>
                    {!data.academicHistory?.[0]?.general_average || !data.academicHistory?.[0]?.grades || Object.keys(data.academicHistory[0].grades).length === 0 ? (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-sm border border-gray-200 mt-1 dark:bg-muted dark:border-border">AWAITING GRADES</span>
                    ) : (
                      <span className="text-3xl font-black text-primary">
                        {data.academicHistory[0].general_average}
                      </span>
                    )}
                  </div>"""
content = content.replace(old_average, new_average)


# 5. Update Address Logic Bug
old_address1 = """<SectionItem label="Permanent Home Address" value={
                        data.sf1.permanentAddress ? 
                        `${data.sf1.permanentAddress.houseNoStreet || ''} ${data.sf1.permanentAddress.barangay || ''}, ${data.sf1.permanentAddress.cityMunicipality || ''}, ${data.sf1.permanentAddress.province || ''}`.trim() : null
                      } />"""
old_address2 = """<SectionItem label="Current Home Address" value={
                        data.sf1.currentAddress ? 
                        `${data.sf1.currentAddress.houseNoStreet || ''} ${data.sf1.currentAddress.barangay || ''}, ${data.sf1.currentAddress.cityMunicipality || ''}, ${data.sf1.currentAddress.province || ''}`.trim() : "Same as Permanent Address"
                      } />"""

new_address_combined = """<SectionItem label="Permanent Home Address" value={
                        data.sf1.permanentAddress ? 
                        `${data.sf1.permanentAddress.houseNoStreet || ''} ${data.sf1.permanentAddress.barangay || ''}, ${data.sf1.permanentAddress.cityMunicipality || ''}, ${data.sf1.permanentAddress.province || ''}`.replace(/\s+/g, ' ').trim() : null
                      } />
                      <SectionItem label="Current Home Address" value={
                        (() => {
                          if (!data.sf1.permanentAddress && !data.sf1.currentAddress) return null;
                          if (!data.sf1.currentAddress) return "Same as Permanent Address";
                          return `${data.sf1.currentAddress.houseNoStreet || ''} ${data.sf1.currentAddress.barangay || ''}, ${data.sf1.currentAddress.cityMunicipality || ''}, ${data.sf1.currentAddress.province || ''}`.replace(/\s+/g, ' ').trim();
                        })()
                      } />"""

content = content.replace(old_address1 + "\n                      " + old_address2, new_address_combined)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Dashboard UX patched.")
