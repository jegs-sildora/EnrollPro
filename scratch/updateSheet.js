const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'client', 'src', 'features', 'admin', 'components', 'UserAccountFormSheet.tsx');
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Add props
code = code.replace(
  /  onGeneratePassword\?: \(\) => void;\n  onCopyPassword\?: \(password: string\) => void;\n  passwordCopied\?: boolean;\n}/,
  `  onGeneratePassword?: () => void;
  onCopyPassword?: (password: string) => void;
  passwordCopied?: boolean;
  onToggleStatus?: (action: "deactivate" | "reactivate") => void;
  onResetPassword?: (newPassword: string) => void;
}`
);

code = code.replace(
  /  passwordCopied,\n}: UserAccountFormSheetProps\) {/,
  `  passwordCopied,
  onToggleStatus,
  onResetPassword,
}: UserAccountFormSheetProps) {`
);

// 2. Wrap Sections 2, 3, 4 in `{mode === "create" && (`
code = code.replace(
  /\{\/\* 2\. Personal Information Section \*\/\}/,
  `{/* 2. Personal Information Section */}
              {mode === "create" && (`
);

code = code.replace(
  /\{\/\* 5\. Security Section \(Create Mode Only\) \*\/\}/,
  `)}

              {/* 5. Security Section (Create Mode Only) */}`
);

// 3. Add Security Management for edit mode right before Section 5
code = code.replace(
  /\{\/\* 5\. Security Section \(Create Mode Only\) \*\/\}/,
  `{/* Security Management Section (Edit Mode) */}
              {mode === "edit" && user && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4">
                  <div className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      2. Security & Authentication
                    </span>
                  </div>
                  <div className="px-5 pb-5 pt-4 space-y-6">
                    {/* Active Status Switch */}
                    <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-sm font-black uppercase">Account Status</Label>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase">
                          {user.isActive ? "This account is currently active and can access the system." : "This account is deactivated. The user cannot log in."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={user.isActive ? "destructive" : "outline"}
                        size="sm"
                        className="font-bold uppercase"
                        onClick={() => onToggleStatus?.(user.isActive ? "deactivate" : "reactivate")}
                      >
                        {user.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>

                    {/* Manual Password Override */}
                    <div className="space-y-3 p-4 bg-background border rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-sm font-black uppercase">Manual Password Override</Label>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase">
                          Force a new temporary password for this user. They will be required to change it upon next login.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="New Password"
                          value={formData.password || ""}
                          onChange={(e) => onFieldChange("password", e.target.value)}
                          className="font-bold text-sm bg-background h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerate}
                          className="w-10 h-10 px-0"
                        >
                          <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            if (formData.password) {
                              onResetPassword?.(formData.password);
                            }
                          }}
                          disabled={!formData.password || formData.password.length < 8}
                          className="font-bold uppercase h-10"
                        >
                          Update Password
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Security Section (Create Mode Only) */}`
);

fs.writeFileSync(filePath, code);
console.log("Updated UserAccountFormSheet.tsx");
