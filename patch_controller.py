import sys

file_path = "server/src/features/learner/learner.controller.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace address logic
old_address_logic = """    permanentAddress: activeApp?.addresses?.find(a => a.addressType === 'PERMANENT') || activeApp?.addresses?.[0] || null,
    currentAddress: activeApp?.addresses?.find(a => a.addressType === 'CURRENT') || null,"""

new_address_logic = """    permanentAddress: activeApp?.addresses?.find(a => a.addressType === 'PERMANENT') || activeApp?.addresses?.[0] || null,
    currentAddress: (() => {
      const rawCurrent = activeApp?.addresses?.find(a => a.addressType === 'CURRENT');
      if (rawCurrent && (rawCurrent.houseNoStreet || rawCurrent.barangay || rawCurrent.cityMunicipality || rawCurrent.province)) {
        return rawCurrent;
      }
      return null;
    })(),"""

content = content.replace(old_address_logic, new_address_logic)

# Replace return payload
old_return = """    schoolName: schoolSetting.schoolName,
    schoolAcronym: schoolSetting.schoolName.replace(/[^A-Z]/g, ''),
    schoolLogoUrl: schoolSetting.logoUrl,
  });"""

new_return = """    schoolName: schoolSetting.schoolName,
    schoolAcronym: schoolSetting.schoolName.replace(/[^A-Z]/g, ''),
    schoolLogoUrl: schoolSetting.logoUrl,
    active_quarter: 1, // Mocked or derived from SystemPhase in real implementations
  });"""

content = content.replace(old_return, new_return)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Controller patched.")
