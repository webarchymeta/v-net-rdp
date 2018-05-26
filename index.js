const {
    app,
    BrowserWindow,
    Menu,
    MenuItem,
    Tray,
    ipcMain
} = require('electron'),
    path = require('path'),
    os = require('os'),
    child_proc = require('child_process');

const refresh_seconds = 10;

const
    config = require(__dirname + '/config.json'),
    booter = new(require(__dirname + '/libs/bootstrapper'))({
        refresh_seconds: refresh_seconds
    });


if (config.production_mode && config.packaged) {
    const cdir = path.dirname(process.execPath);
    if (process.cwd() !== cdir) {
        process.chdir(cdir);
    }
}

let tray = null;
let mainEntry = undefined;

if (!process.env.PRODUCTION_MODE) {
    const shouldQuit = app.makeSingleInstance((argv, wkdir) => {
        if (tray) {

        }
    });

    if (shouldQuit) {
        app.quit();
        return;
    }
}

const launch_it = gw => {
    const child_opts = {
        cwd: process.cwd(),
        detached: false,
        shell: false,
        env: {}
    };
    if (gw.name) {
        child_opts.env.CONTEXT_TITLE = gw.name;
        child_opts.env.SOCKS5_ADDRESS = gw.answers[0].targets[0];
        child_opts.env.SOCKS5_PORT = gw.answers[0].port;
        if (gw.auth_required) {
            //child_opts.env.SOCKS5_AUTH = 'true';
            child_opts.env.SOCKS5_AUTH = Buffer.from(JSON.stringify({
                u: gw.username,
                p: gw.password
            }), 'utf8').toString('base64');
        }
    };
    const keys = Object.keys(process.env);
    keys.forEach(k => {
        child_opts.env[k] = process.env[k];
    });
    if (!config.production_mode) {
        gw.proc = child_proc.spawn(path.join(process.cwd(), 'node_modules/electron/dist/electron' + (os.platform() === 'win32' ? '.exe' : '')), ['main-entry.js'], child_opts);
    } else {
        child_opts.env.PRODUCTION_MODE = true;
        if (!config.packaged) {
            gw.proc = child_proc.spawn(path.join(process.cwd(), 'node_modules/electron/dist/electron' + (os.platform() === 'win32' ? '.exe' : '')), ['index.js'], child_opts);
        } else {
            gw.proc = child_proc.spawn(path.join(process.cwd(), config.package_name + (os.platform() === 'win32' ? '.exe' : '')), [], child_opts);
        }
    }
    gw.proc.on('error', err => {
        console.log(err);
    });
    gw.proc.on('exit', function(code, sig) {
        this.started = false;
        this.proc = undefined;
        console.log(`process exited with code ${code}, sig: ${sig}`);
    }.bind(gw));
    if (gw.auth_required) {
        /*
        gw.proc.stdin.setEncoding('utf8');
        gw.proc.stdin.write(JSON.stringify({
            u: gw.username,
            p: gw.password
        }));
        gw.proc.stdin.end();
        */
    }
    if (gw.proc.stdout) {
        gw.proc.stdout.on('data', (data) => {
            console.log(`local-out: ${data}`);
        });
        gw.proc.stderr.on('data', (data) => {
            console.error(`local-error: ${data}`);
        });
    }
    gw.started = true;
};

const launcher = function(m, w, e) {
    const gw = this;
    if (gw.started)
        return;
    const now = (new Date()).getTime();
    if (!gw.auth_required || gw.last_credential_load && (now - gw.last_credential_load) < 60 * 1000) {
        launch_it(gw);
    } else {
        const wopts = {
            title: 'User Credential',
            width: 700,
            height: 250,
            frame: false,
            show: false,
            transparent: true
        };
        const login = new BrowserWindow(wopts);
        ipcMain.once('user-credential', (e, msg) => {
            if (msg.ok) {
                gw.username = msg.username;
                gw.password = msg.password;
                gw.last_credential_load = (new Date()).getTime();
                launch_it(gw);
            }
        });
        login.loadURL('file://' + require('path').join(__dirname, 'client/html/login.html'));
        login.show();
    }
};

let gateway_ports = [];
let last_update = undefined;

app.on('window-all-closed', () => {
    if (mainEntry) {
        mainEntry.teardown();
    }
});

const updater = () => {
    return booter.update_ports().then(r => {
        const old_ports = gateway_ports.map(p => p);
        gateway_ports = [];
        last_update = (new Date()).getTime();
        r.ports.forEach(gwp => {
            const old = old_ports.find(p => p.name === gwp.name);
            if (old) {
                gwp.proc = old.proc;
                gwp.started = old.started;
            }
            gateway_ports.push(gwp);
        });
        if (r.more) {
            r.more.on('more', function(gwp) {
                const old = this.find(p => p.name === gwp.name);
                if (old) {
                    gwp.proc = old.proc;
                    gwp.started = old.started;
                }
                gateway_ports.push(gwp);
            }.bind(old_ports));
        }
        setTimeout(function() {
            if (this.more) {
                this.more.removeAllListeners('more');
                this.more = undefined;
            }
            booter.close();
        }.bind(r), 10000);
    });
};

const local_browser = {
    started: false
};

app.on('ready', () => {
    if (!process.env.PRODUCTION_MODE) {
        booter.update_ports().then(r => {
            last_update = (new Date()).getTime();
            const getMenu = gw_lst => {
                const contextMenu = new Menu();
                contextMenu.append(new MenuItem({
                    icon: __dirname + '/client/img//blue-dot.png',
                    label: 'Local Browsing',
                    sublabel: 'Start browsing local resources ...',
                    click: launcher.bind(local_browser)
                }));
                contextMenu.append(new MenuItem({
                    type: 'separator'
                }));
                gw_lst.sort((a, b) => a.name > b.name ? 1 : -1).filter(gw => gw.serving).forEach(gw => {
                    contextMenu.append(new MenuItem({
                        icon: gw.auth_required ? __dirname + '/client/img/green-locked-dot.png' : __dirname + '/client/img/green-dot.png',
                        label: gw.name,
                        sublabel: gw.descr || ' ... ',
                        click: launcher.bind(gw)
                    }));
                });
                contextMenu.append(new MenuItem({
                    type: 'separator'
                }));
                contextMenu.append(new MenuItem({
                    label: 'Exit',
                    click: (m, w, e) => {
                        app.quit();
                    }
                }));
                return contextMenu;
            };
            r.ports.forEach(gwp => {
                gateway_ports.push(gwp);
            });
            r.more.on('more', (gwp) => {
                gateway_ports.push(gwp);
            });
            tray = new Tray(__dirname + '/client/img/main-icon.png');
            tray.on('click', (e, b) => {
                const now = (new Date()).getTime();
                if (now - last_update > refresh_seconds * 1000) {
                    updater().then(() => {
                        tray.setContextMenu(getMenu(gateway_ports));
                        tray.popUpContextMenu();
                    });
                } else {
                    tray.setContextMenu(getMenu(gateway_ports));
                    tray.popUpContextMenu();
                }
            });
            tray.on('right-click', (e) => {
                e.preventDefault();
            });
            tray.setToolTip('V-NET Trans-LAN Remote Desktop Client');
            setTimeout(function() {
                if (this.more) {
                    this.more.removeAllListeners('more');
                    this.more = undefined;
                }
                booter.close();
            }.bind(r), 10000);
        });
    } else {
        mainEntry = require(__dirname + '/main-entry');
        mainEntry.startup();
    }
});