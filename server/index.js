'use strict';
/*
 * Copyright (c) 2015 Sylvain Peyrefitte
 * Copyright (c) 2016 Shuqian Ying
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

const {
    ipcMain
} = require('electron');

const
    rdp = require('node-rdpjs');

module.exports = {
    start: (proxy) => {
        var rdpClient = null;
        ipcMain.on('infos', (e, infos) => {
            if (rdpClient) {
                rdpClient.close();
            };
            console.log(infos);
            let client = e.sender;
            rdpClient = rdp.createClient({
                domain: infos.domain,
                userName: infos.username,
                password: infos.password,
                enablePerf: true,
                autoLogin: true,
                screen: infos.screen,
                locale: infos.locale,
                logLevel: process.argv[2] || 'INFO',
                proxy: proxy
            }).on('connect', () => {
                client.send('rdp-connect');
            }).on('bitmap', (bitmap) => {
                client.send('rdp-bitmap', bitmap);
            }).on('close', () => {
                client.send('rdp-close');
            }).on('error', (err) => {
                client.send('rdp-error', err);
            }).connect(infos.ip, infos.port);
        }).on('mouse', (e, x, y, button, isPressed) => {
            if (!rdpClient)
                return;
            rdpClient.sendPointerEvent(x, y, button, isPressed);
        }).on('wheel', (e, x, y, step, isNegative, isHorizontal) => {
            if (!rdpClient)
                return;
            rdpClient.sendWheelEvent(x, y, step, isNegative, isHorizontal);
        }).on('scancode', (e, code, isPressed) => {
            if (!rdpClient)
                return;
            rdpClient.sendKeyEventScancode(code, isPressed);
        }).on('unicode', (e, code, isPressed) => {
            if (!rdpClient)
                return;
            rdpClient.sendKeyEventUnicode(code, isPressed);
        }).on('disconnect', (e) => {
            if (!rdpClient)
                return;
            rdpClient.close();
            rdpClient = undefined;
        });
    }
};