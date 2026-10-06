document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');

  const sendMessage = async (action) => {
    try {
      // In Manifest V3, we must use chrome.* for Chrome, but browser.* is preferred in Firefox.
      // We'll use chrome.tabs to support both if polyfills aren't included, as Firefox supports chrome.* aliases for standard APIs.
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) return;

      // Inject content script dynamically if it's not already there.
      // (For a robust extension, it's better to declare it in manifest, but dynamic injection via scripting API is also fine.
      // Here, we rely on scripting API to execute the content script).
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      });

      // Send the message to the content script
      chrome.tabs.sendMessage(tabs[0].id, { action }, (response) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = 'Error: ' + chrome.runtime.lastError.message;
          statusEl.style.color = 'red';
        } else {
          statusEl.textContent = response?.message || 'Autofill triggered!';
          statusEl.style.color = '#16a34a';
          setTimeout(() => { statusEl.textContent = ''; }, 2000);
        }
      });
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.style.color = 'red';
    }
  };

  document.getElementById('btn-early-reg').addEventListener('click', () => {
    sendMessage('FILL_EARLY_REGISTRATION');
  });

  document.getElementById('btn-scp').addEventListener('click', () => {
    sendMessage('FILL_SCP_ADMISSION');
  });

  document.getElementById('btn-enrollment').addEventListener('click', () => {
    sendMessage('FILL_ENROLLMENT');
  });
});
