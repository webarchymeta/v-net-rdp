'use strict';

const {
    BrowserWindow,
    app,
    ipcMain
} = require('electron');

const
    path = require('path'),
    os = require('os'),
    dns_client = require(__dirname + '/libs/dns-client'),
    app_register = require(__dirname + '/libs/app-register'),
    server = require(__dirname + '/server'),
    mainDbApi = require(__dirname + '/libs/main-db-api'),
    winStateUpdator = require(__dirname + '/libs/state-updator');

const mainWindowId = 'main-window';

let mainWindow = null;
let mainDB, stateUpdator;

ipcMain.on('mdns-query', (e, q) => {
    const dns = new dns_client();
    dns.find(q.hostname, 'SRV').then(resp => {
        e.sender.send('mdns-query-ack', {
            ok: true,
            response: resp
        });
    }).catch(err => {
        e.sender.send('mdns-query-ack', {
            ok: false,
            error: err
        });
    });
});

const createWindow = initBounds => {
    const wopts = {
        width: initBounds ? initBounds.width : 1530,
        height: initBounds ? initBounds.height : 920,
        autoHideMenuBar: true,
        icon: __dirname + '/client/img/v-net-rdp.png'
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

const run = () => {
    const start_up = opts => {
        const startupOpts = opts ? {
            socksHost: opts.socksAddress,
            socksPort: opts.socksPort
        } : undefined;
        if (opts && opts.socksUsername) {
            startupOpts.socksUsername = opts.socksUsername;
            startupOpts.socksPassword = opts.socksPassword;
        }
        server.start(startupOpts);
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
    if (!process.env.SOCKS5_AUTH) {
        start_up(process.env.SOCKS5_ADDRESS ? {
            socksAddress: process.env.SOCKS5_ADDRESS,
            socksPort: process.env.SOCKS5_PORT
        } : undefined);
    } else {
        const uinfo = JSON.parse(Buffer.from(process.env.SOCKS5_AUTH, 'base64').toString('utf8'));
        start_up({
            socksAddress: process.env.SOCKS5_ADDRESS,
            socksPort: process.env.SOCKS5_PORT,
            socksUsername: uinfo.u,
            socksPassword: uinfo.p
        });
    }
};

const windowAllClosed = () => {
    stateUpdator.flush().then(() => {
        return mainDB.close().then(() => {
            if (process.platform != 'darwin') {
                app.quit();
            }
        });
    });
    if (!process.env.PRODUCTION_MODE) {
        app_register.close();
    }
};

if (!process.env.PRODUCTION_MODE) {
    app.on('window-all-closed', windowAllClosed);
    app.on('ready', () => {
        if (app_register.regist(app)) {
            run();
        }
    });
} else {
    module.exports = {
        startup: run,
        teardown: windowAllClosed
    };
}