'use strict';

const {
    BrowserWindow,
    app,
    ipcMain
} = require('electron');

const
    path = require('path'),
    os = require('os'),
    app_register = require(__dirname + '/libs/app-register'),
    server = require(__dirname + '/server'),
    mainDbApi = require(__dirname + '/libs/main-db-api'),
    winStateUpdator = require(__dirname + '/libs/state-updator');

const mainWindowId = 'main-window';

let mainWindow = null;
let mainDB, stateUpdator;

app.on('window-all-closed', () => {
    stateUpdator.flush().then(() => {
        return mainDB.close().then(() => {
            if (process.platform != 'darwin') {
                app.quit();
            }
        });
    });
    app_register.close();
});

const createWindow = (initBounds) => {
    const wopts = {
        width: initBounds ? initBounds.width : 1530,
        height: initBounds ? initBounds.height : 920,
        autoHideMenuBar: true,
    };
    if (initBounds) {
        wopts.x = initBounds.loc_x;
        wopts.y = initBounds.loc_y;
    }
    mainWindow = new BrowserWindow(wopts);
    //mainWindow.openDevTools();
    mainWindow.loadURL('file://' + require('path').join(__dirname, 'client/html/index.html'));

    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('maximize');
    });
    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('unmaximize');
    });

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.maximize();
        let copts = {
            has_context: !!process.env.SOCKS5_ADDRESS
        };
        if (copts.has_context) {
            copts.context_title = process.env.CONTEXT_TITLE;
            copts.start_url = process.env.START_URL;
            copts.socks5_address = process.env.SOCKS5_ADDRESS;
            copts.socks5_port = process.env.SOCKS5_PORT;
        }
        mainWindow.webContents.send('runtime-context-update', copts);
    });

    mainWindow.on('resize', () => {
        stateUpdator.updateWindowState(mainWindowId, {
            bounds: mainWindow.getBounds()
        })
    });
    mainWindow.on('move', () => {
        stateUpdator.updateWindowState(mainWindowId, {
            bounds: mainWindow.getBounds()
        })
    });

    mainWindow.on('enter-full-screen', () => {

    });
    mainWindow.on('leave-full-screen', () => {

    });

    mainWindow.on('closed', () => {
        mainWindow = null
    });
};

app.on('ready', () => {
    if (app_register.regist(app)) {
        const start_up = opts => {
            server.start(opts ? {
                socksHost: opts.socksAddress,
                socksPort: opts.socksPort
            } : undefined);
            mainDB = new mainDbApi({
                home: app.getPath('appData'),
                path: app.getName() + '/databases'
            });
            mainDB.open().then(() => {
                stateUpdator = new winStateUpdator(mainDB);
                mainDB.find({
                    table: 'window-states',
                    predicate: '"window_id"=\'' + mainWindowId + '\''
                }).then((wstate) => {
                    createWindow(wstate);
                });
            });
        };
        start_up(process.env.SOCKS5_ADDRESS ? {
            socksAddress: process.env.SOCKS5_ADDRESS,
            socksPort: process.env.SOCKS5_PORT
        } : undefined);
    }
});