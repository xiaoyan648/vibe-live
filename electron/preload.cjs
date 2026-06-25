const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vibeLiveOpenAI", {
  chatCompletionsCreate(payload) {
    return ipcRenderer.invoke("vibelive:chat-completions", payload);
  },
  imagesGenerate(payload) {
    return ipcRenderer.invoke("vibelive:images-generate", payload);
  },
});
