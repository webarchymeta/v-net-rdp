'use strict';

const {
    BrowserWindow,
    app,
    ipcMain
} = require('electron');

const
    crypto = require('crypto'),
    inter_proc_ipc = require('node-ipc'),
    server = require(__dirname + '/server'),
    mainDbApi = require(__dirname + '/libs/main-db-api'),
    winStateUpdator = require(__dirname + '/libs/state-updator');

const mainWindowId = 'main-window';

let mainWindow = null;
let mainDB, stateUpdator;

const get_app_id = () => {
    let md5 = crypto.createHash('md5');
    md5.update(__filename.toLowerCase());
    return md5.digest('hex');
};

app.on('window-all-closed', () => {
    stateUpdator.flush().then(() => {
        return mainDB.close().then(() => {
            if (process.platform != 'darwin') {
                app.quit();
            }
        });
    });
    inter_proc_ipc.of.inter_app_services.emit('socks-client-status', {
        id: get_app_id(),
        pid: process.pid,
        started: false
    });
});

const register_app = () => {
    inter_proc_ipc.config.id = 'socks_app_register';
    inter_proc_ipc.config.retry = 1500;
    inter_proc_ipc.connectTo('inter_app_services', () => {
        inter_proc_ipc.of.inter_app_services.on('connect', () => {
            inter_proc_ipc.log('## connected to inter_app_services ##'.rainbow, inter_proc_ipc.config.delay);
            let data = {
                id: get_app_id(),
                categ: 'socks',
                type: 'remote-desktop',
                runtime: 'electron',
                name: app.getName(),
                appPath: __dirname,
                pid: process.pid,
                started: true,
            };
            inter_proc_ipc.of.inter_app_services.emit('socks-client-register', data);
        });
        inter_proc_ipc.of.inter_app_services.on('disconnect', () => {
            inter_proc_ipc.log('disconnected from socks_app_register'.notice);
        });
        inter_proc_ipc.of.inter_app_services.on('socks-client-register-ack', (data) => {
            inter_proc_ipc.log('got a message from socks_app_register : '.debug, data);
        });
    });
};

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
    console.log('window created ...');
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
    register_app();
    server.start(process.env.SOCKS5_ADDRESS ? {
        socksHost: process.env.SOCKS5_ADDRESS,
        socksPort: process.env.SOCKS5_PORT
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
});