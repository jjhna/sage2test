'use strict';

const electron = require('electron');
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

// app.commandLine.appendSwitch('enable-usermedia-screen-capturing');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {

	var options = {
		width: 1280,
		height: 720,
		frame: false
	}
	if (process.platform === 'darwin') {
		// nothing yet
	} else {
		options.titleBarStyle = "hidden";
	}

	// webPreferences: {
	// 	nodeIntegration: true,
	// 	webSecurity: true,
	// }

	// Create the browser window.
	mainWindow = new BrowserWindow(options);

	// mainWindow.setFullScreen(true);
	mainWindow.setPosition(0, 0);

	// console.log('Process', process.argv);
	// arg 0 : electron
	// arg 1 : script
	var location = process.argv[2] || "http://localhost:9292/display.html?clientID=0";
	mainWindow.loadURL(location);

	// Open the DevTools.
	// mainWindow.webContents.openDevTools();

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});

	mainWindow.webContents.on('will-navigate', function(ev) {
		console.log('will-navigate')
		ev.preventDefault();
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', function () {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow();
	}
});


