const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/shared/layouts/AppLayout.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the entire DropdownMenuItem
const startIndex = content.indexOf('<DropdownMenuItem\r\n            className="flex items-center justify-between py-2 font-bold cursor-pointer"');
const endIndex = content.indexOf('</DropdownMenuItem>', startIndex) + '</DropdownMenuItem>'.length;

const replacement = `<DropdownMenuItem
            className="flex items-center justify-between py-2 font-bold cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              const nextState = !showTimeMachineWidget;
              setShowTimeMachineWidget(nextState);
              if (!nextState) {
                localStorage.removeItem(MOCKED_SYSTEM_DATE_KEY);
                localStorage.removeItem(MOCKED_SYSTEM_DATE_ANCHOR_KEY);
              }
              api.patch("/system/time-machine", { enabled: nextState }).finally(() => {
                if (!nextState) window.location.reload();
              });
            }}
          >
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              <span>Enable Time Machine</span>
            </div>
            <Switch
              checked={showTimeMachineWidget}
              onCheckedChange={(checked) => {
                setShowTimeMachineWidget(checked);
                if (!checked) {
                  localStorage.removeItem(MOCKED_SYSTEM_DATE_KEY);
                  localStorage.removeItem(MOCKED_SYSTEM_DATE_ANCHOR_KEY);
                }
                api.patch("/system/time-machine", { enabled: checked }).finally(() => {
                  if (!checked) window.location.reload();
                });
              }}
              className="ml-4"
            />
          </DropdownMenuItem>`;

if (startIndex !== -1) {
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync(file, content);
} else {
  console.log("NOT FOUND");
}
