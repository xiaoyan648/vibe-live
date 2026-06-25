const { app, BrowserWindow, ipcMain, net, protocol, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const APP_SCHEME = "app";
const APP_HOST = "vibe-live";

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getStaticRoot() {
  return path.join(app.getAppPath(), "out");
}

function getRuntimeIconPath() {
  const candidates = [
    path.join(process.resourcesPath, "icon.png"),
    path.join(app.getAppPath(), "build", "icon.png"),
    path.join(__dirname, "..", "build", "icon.png"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function applyAppIcon() {
  const iconPath = getRuntimeIconPath();

  if (process.platform === "darwin" && iconPath && app.dock) {
    app.dock.setIcon(iconPath);
  }

  return iconPath;
}

function resolveStaticFile(requestUrl) {
  const url = new URL(requestUrl);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  } else if (pathname.endsWith("/")) {
    pathname += "index.html";
  } else if (!path.extname(pathname)) {
    pathname = `${pathname}/index.html`;
  }

  const root = getStaticRoot();
  const requested = path.normalize(path.join(root, pathname));
  const rootWithSep = path.normalize(`${root}${path.sep}`);

  if (!requested.startsWith(rootWithSep)) {
    return path.join(root, "index.html");
  }

  return fs.existsSync(requested) ? requested : path.join(root, "index.html");
}

function normalizeBaseUrl(value) {
  const baseURL = typeof value === "string" && value.trim() ? value.trim() : "https://api.openai.com/v1";
  return baseURL.replace(/\/+$/, "");
}

async function requestOpenAIPath(payload, pathname) {
  const apiKey = typeof payload?.apiKey === "string" ? payload.apiKey.trim() : "";
  const body = payload?.body && typeof payload.body === "object" ? payload.body : null;

  if (!apiKey) {
    throw new Error("Missing API key");
  }

  if (!body) {
    throw new Error("Missing request body");
  }

  const response = await net.fetch(`${normalizeBaseUrl(payload?.baseURL)}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(responseBody?.error?.message || `OpenAI request failed with ${response.status}`);
  }

  return responseBody;
}

ipcMain.handle("vibelive:chat-completions", async (_event, payload) => {
  return requestOpenAIPath(payload, "/chat/completions");
});

ipcMain.handle("vibelive:images-generate", async (_event, payload) => {
  return requestOpenAIPath(payload, "/images/generations");
});

function isToggleDevToolsInput(input) {
  const key = typeof input?.key === "string" ? input.key.toLowerCase() : "";
  return key === "f12" || (key === "i" && input.alt && (input.meta || input.control));
}

async function createWindow() {
  const iconPath = getRuntimeIconPath();
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "VibeLive",
    ...(iconPath ? { icon: iconPath } : {}),
    backgroundColor: "#09070f",
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && isToggleDevToolsInput(input)) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${APP_SCHEME}://${APP_HOST}`)) {
      return { action: "allow" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  const devUrl = process.env.ELECTRON_START_URL;
  await win.loadURL(devUrl || `${APP_SCHEME}://${APP_HOST}/`);
}

app.whenReady().then(async () => {
  applyAppIcon();

  protocol.handle(APP_SCHEME, (request) => {
    const fileUrl = pathToFileURL(resolveStaticFile(request.url)).toString();
    return net.fetch(fileUrl);
  });

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
