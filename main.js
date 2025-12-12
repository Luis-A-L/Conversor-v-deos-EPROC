const { app, BrowserWindow, session, shell } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: "TJPR Compressor EPROC",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Simplifica o uso com o código React existente
      webSecurity: true,
    },
    autoHideMenuBar: true,
  });

  // Carrega o index.html
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Abre links externos no navegador padrão, não dentro do app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});