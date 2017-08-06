Derived from [mstsc.js](https://github.com/citronneur/mstsc.js).

# 1-NET Windows remote desktop client

A trans- local area network windows (trans-LAN) remote desktop client for 1-NET, based on electron.

It is hard and expensive to do secured remote desktop access to Windows machines across LAN. 1-NET provide a viable solution to the problem.

**Install instructions**

To run this code, follow these steps:

```
git clone https://github.com/webarchymeta/1-net-rdp
cd 1-net-rdp
npm install
npm run bootstrap
```

The last command will start a tray icon on user's desktop. When clicked, a list of active 1-NET gateway ports available to the current LAN will be listed.

```
npm start
```

Starts the browser in normal mode, without going through a the 1-NET gateway tunnel.

```
npm run register
```

Registers the browser with a running 1-NET desktop client, which can be used to launch the browser for a specific 1-NET gateway tunnel (port) from within.
