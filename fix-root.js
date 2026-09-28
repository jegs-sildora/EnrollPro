const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/shared/layouts/RootLayout.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `      if (data.systemDateOverride) {
        const dateStr = new Date(data.systemDateOverride.mockedTimestamp).toISOString();
        localStorage.setItem('mocked_system_date', dateStr);
        localStorage.setItem('mocked_system_date_anchor', String(data.systemDateOverride.anchoredAt));
        setSettings({ showTimeMachineWidget: true });
      } else {
        localStorage.removeItem('mocked_system_date');
        localStorage.removeItem('mocked_system_date_anchor');
        setSettings({ showTimeMachineWidget: false });
      }`;

const targetStr2 = targetStr.replace(/\n/g, '\r\n');

const replacement = `      if (data.isTimeMachineEnabled) {
        setSettings({ showTimeMachineWidget: true });
        if (data.systemDateOverride) {
          const dateStr = new Date(data.systemDateOverride.mockedTimestamp).toISOString();
          localStorage.setItem('mocked_system_date', dateStr);
          localStorage.setItem('mocked_system_date_anchor', String(data.systemDateOverride.anchoredAt));
        }
      } else {
        localStorage.removeItem('mocked_system_date');
        localStorage.removeItem('mocked_system_date_anchor');
        setSettings({ showTimeMachineWidget: false });
      }`;

if (content.includes(targetStr)) {
  fs.writeFileSync(file, content.replace(targetStr, replacement));
} else if (content.includes(targetStr2)) {
  fs.writeFileSync(file, content.replace(targetStr2, replacement));
} else {
  console.log("NOT FOUND");
}
