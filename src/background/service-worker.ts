chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_EXTENSION" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_TAB_INFO") {
    sendResponse({
      url: sender.tab?.url ?? "",
      title: sender.tab?.title ?? "",
    });
  }

  return true;
});
