Derived from [mstsc.js](https://github.com/citronneur/mstsc.js).

# V-NET Windows remote desktop client

A trans- local area network windows (trans-LAN) remote desktop client for V-NET, based on electron.

It is hard and expensive to do secured remote desktop access to Windows machines across LAN. V-NET provide a viable solution to the problem.

**Prerequisites**

* Install latest LTS version of `nodejs`.

**Install instructions**

To run this code, follow these steps:

```
git clone https://github.com/webarchymeta/v-net-rdp
cd v-net-rdp
npm install
npm run bootstrap
```

The last command will start a tray icon on user's desktop. When clicked, a list of active V-NET gateway ports available to the current LAN will be listed.

```
npm start
```

Starts the remote desktop client in normal mode, without going through a the V-NET gateway tunnel.

```
npm run register
```

Registers the remote desktop client with a running V-NET desktop client, which can be used to launch the remote desktop client for a specific V-NET gateway tunnel (port) from within.
