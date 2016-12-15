'use strict';
/*
 * Copyright (c) 2015 Sylvain Peyrefitte
 * Copyright (c) 2016 Shuqian Ying
 *
 * This file is part of mstsc.js.
 *
 * mstsc.js is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

(function() {
    /**
     * Mouse button mapping
     * @param button {integer} client button number
     */
    function mouseButtonMap(button) {
        switch (button) {
            case 0:
                return 1;
            case 2:
                return 2;
            default:
                return 0;
        }
    };

    /**
     * Mstsc client
     * Input client connection (mouse and keyboard)
     * bitmap processing
     * @param canvas {canvas} rendering element
     * @param next {function} asynchrone end callback
     */
    function Client(canvas, next) {
        this.canvas = canvas;
        // create renderer
        this.render = new Mstsc.Canvas.create(this.canvas);
        this.socket = null;
        this.activeSession = false;
        this.next = next;
        this.install();
    }

    Client.prototype = {
        install: function() {
            var self = this;
            self.ipc = require('electron').ipcRenderer;

            self.ipc.on('runtime-context-update', (e, context) => {
                console.log(context);
                /*
                window.__frame_element.state.runtime_context = context;
                window.__frame_element.setState(window.__frame_element.state);
				*/
                document.title += '   --   Target: ' + context.context_title;
            }).on('maximize', (e) => {
                document.body.style.overflow = 'hidden';
            }).on('unmaximize', (e) => {
                document.body.style.overflow = 'auto';
            }).on('rdp-connect', (e) => {
                // this event can be occured twice (RDP protocol stack artefact)
                console.log('[mstsc.js] connected');
                self.activeSession = true;
            }).on('rdp-bitmap', (e, bitmap) => {
                console.log('[mstsc.js] bitmap update bpp : ' + bitmap.bitsPerPixel);
                self.render.update(bitmap);
            }).on('rdp-close', (e) => {
                self.next(null);
                console.log('[mstsc.js] close');
                self.activeSession = false;
            }).on('rdp-error', (e, err) => {
                self.next(err);
                console.log('[mstsc.js] error : ' + err.code + '(' + err.message + ')');
                self.activeSession = false;
            });

            // bind mouse move event
            self.canvas.addEventListener('mousemove', (e) => {
                if (!self.ipc)
                    return;
                var offset = Mstsc.elementOffset(self.canvas);
                self.ipc.send('mouse', e.clientX - offset.left, e.clientY - offset.top, 0, false);
                e.preventDefault || !self.activeSession();
                return false;
            });
            self.canvas.addEventListener('mousedown', (e) => {
                if (!self.ipc)
                    return;
                var offset = Mstsc.elementOffset(self.canvas);
                self.ipc.send('mouse', e.clientX - offset.left, e.clientY - offset.top, mouseButtonMap(e.button), true);
                e.preventDefault();
                return false;
            });
            self.canvas.addEventListener('mouseup', (e) => {
                if (!self.ipc || !self.activeSession)
                    return;
                var offset = Mstsc.elementOffset(self.canvas);
                self.ipc.send('mouse', e.clientX - offset.left, e.clientY - offset.top, mouseButtonMap(e.button), false);
                e.preventDefault();
                return false;
            });
            self.canvas.addEventListener('contextmenu', (e) => {
                if (!self.ipc || !self.activeSession)
                    return;
                var offset = Mstsc.elementOffset(self.canvas);
                self.ipc.send('mouse', e.clientX - offset.left, e.clientY - offset.top, mouseButtonMap(e.button), false);
                e.preventDefault();
                return false;
            });
            self.canvas.addEventListener('DOMMouseScroll', (e) => {
                if (!self.ipc || !self.activeSession)
                    return;
                var isHorizontal = false;
                var delta = e.detail;
                var step = Math.round(Math.abs(delta) * 15 / 8);

                var offset = Mstsc.elementOffset(self.canvas);
                self.ipc.send('wheel', e.clientX - offset.left, e.clientY - offset.top, step, delta > 0, isHorizontal);
                e.preventDefault();
                return false;
            });
            self.canvas.addEventListener('mousewheel', (e) => {
                if (!self.ipc || !self.activeSession)
                    return;
                var isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
                var delta = isHorizontal ? e.deltaX : e.deltaY;
                var step = Math.round(Math.abs(delta) * 15 / 8);
                var offset = Mstsc.elementOffset(self.canvas);
                self.ipc.send('wheel', e.clientX - offset.left, e.clientY - offset.top, step, delta > 0, isHorizontal);
                e.preventDefault();
                return false;
            });

            // bind keyboard event
            window.addEventListener('keydown', (e) => {
                if (!self.ipc || !self.activeSession)
                    return;
                self.ipc.send('scancode', Mstsc.scancode(e), true);
                e.preventDefault();
                return false;
            });
            window.addEventListener('keyup', (e) => {
                if (!self.ipc || !self.activeSession)
                    return;
                self.ipc.send('scancode', Mstsc.scancode(e), false);
                e.preventDefault();
                return false;
            });

            return this;
        },
        /**
         * connect
         * @param ip {string} ip target for rdp
         * @param domain {string} microsoft domain
         * @param username {string} session username
         * @param password {string} session password
         */
        connect: function(ip, domain, username, password) {
            // emit infos event
            try {
                var self = this;
                self.ipc.send('infos', {
                    ip: ip,
                    port: 3389,
                    screen: {
                        width: self.canvas.width,
                        height: self.canvas.height
                    },
                    domain: domain,
                    username: username,
                    password: password,
                    locale: Mstsc.locale()
                });
            } catch (err) {
                console.log(err);
            }
        }
    }

    Mstsc.client = {
        create: function(canvas, next) {
            return new Client(canvas, next);
        }
    }
})();