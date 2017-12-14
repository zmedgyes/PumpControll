var async = require('async');
var SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;
var aesjs = require('aes-js');
const crypto = require('crypto');
var database = require('./database.js');

var port;
var serialport;
var cmdBuffer = []


var serverPsw = "server";
var serverCode = 1;
var serverKey;

var initMode = false;
var deviceCode = 2;

var defaultLat = 0;
var defaultLng = 0;


var initServer = (callback) => {
    async.series(
        [
            (callback) => {
                createKeyFromPassphrase(1, "server", (err, key) => {
                    if (err) { callback(err) }
                    else {
                        serverKey = key;
                        callback();
                    }
                    console.log("SERVERKEY: " + serverKey.toString('hex'));
                })
            },
            (callback) => {
                database.Setting.findOne({ Name: "defaultLat" }, (err, result) => {
                    if (err) { callback(err) }
                    else {
                        if (result) {
                            defaultLat = parseFloat(result.Value)
                        }
                        callback()
                    }
                })
            },
            (callback) => {
                database.Setting.findOne({ Name: "defaultLng" }, (err, result) => {
                    if (err) { callback(err) }
                    else {
                        if (result) {
                            defaultLng = parseFloat(result.Value)
                        }
                        callback()
                    }
                })
            }
        ],
        callback
    )
    /*crypto.pbkdf2(serverPsw, serverCode.toString(16), 100000, 16, 'sha512', (err, derivedKey) => {
        if (err) { callback(err) }
        else {
            serverKey = derivedKey;
            callback();
        }
        console.log("SERVERKEY: "+derivedKey.toString('hex'));  // '3745e48...08d59ae'
    });*/
}
var createKeyFromPassphrase = (code, passphrase, callback) => {
    const hash = crypto.createHash('md5');
    hash.update(passphrase);
    crypto.pbkdf2(hash.digest().toString('hex'), code.toString(16), 100000, 16, 'sha512', callback);
}

var lookupPort = (callback) => {
    SerialPort.list(function (err, ports) {
        ports.forEach(function (portItem) {
            if (portItem.manufacturer.includes("Arduino")) {
                port = portItem
            }
            console.log(portItem.comName);
            console.log(portItem.pnpId);
            console.log(portItem.manufacturer);
        });
        if (port) {
            async.setImmediate(callback)
        }
        else {
            async.setImmediate(callback, new Error("no fitting port found"))
        }
    });
}
var openSerial = (callback) => {
    var options = {
        baudRate: 57600,
        dataBits: 8,
        stopBits: 1,
        parity: "none"
    }
    serialport = new SerialPort(
        port.comName,
        options,
        callback
    )
}

var processSerial = (code) => {
    if (code.includes("getbufferlength")) {
        serialport.write(cmdBuffer.length.toString())
    }
    else if (code.includes("getnext")) {
        serialport.write(cmdBuffer.pop())
    }
    else if (code.includes("radio_rx")) {
        var hex = code.split(" ")[2]
        var buf = new Buffer(hex, "hex")
        var packet = buf.slice(2,18);
        var sender = buf.readInt8(1);
        var receiver = buf.readInt8(0);
        console.log("to: " + buf.readInt8(0))
        console.log("from: " + buf.readInt8(1))

        var getKey = (callback) => {
            //broadcast
            if (receiver == 0) {
                async.setImmediate(callback, null, serverKey)
            }
            //regular
            else if (receiver == 1) {
                database.Device.findOne({ DeviceId: sender }, (err, result) => {
                    if (err) { callback(err) }
                    else {
                        if (result) {
                            callback(null, aesjs.utils.hex.toBytes(result.DeviceKey))
                        }
                        else {
                            callback(new Error("missing device"))
                        }
                    }
                })
            }
            //register
            else if (receiver == 2) {
                console.log("REGISTER"+sender)
                async.setImmediate(callback, null, serverKey)
            }
            else {
                async.setImmediate(callback, new Error("not server message"))
            }
        }
        var decryptMessage = (key, callback) => {
            var aesCbc = new aesjs.ModeOfOperation.cbc(key);
            var decryptedBytes = Buffer.from(aesCbc.decrypt(packet))
            async.setImmediate(callback, null, decryptedBytes)
        }
        var processMessage = (data, callback) => {
            var type = data.readInt8(0)
            //register
            if (type == 0) {
                var passphrase = data.slice(1, 14).toString()
                createKeyFromPassphrase(sender, passphrase, (err, key) => {
                    if (err) {
                        callback(err)
                    }
                    else {
                        database.Device.findOne({ DeviceId: sender }, (err, result) => {
                            if (!result) {
                                var device = new database.Device()
                                device['DeviceId'] = sender;
                                device['DeviceKey'] = key.toString('hex')
                                device['DeviceActive'] = true;
                                device['PumpActive'] = false;
                                device['Lat'] = defaultLat;
                                device['Lng'] = defaultLng;
                                device.save((err) => {
                                    sendToken()
                                    callback(err)
                                });
                            }
                            else {
                                sendToken()
                                callback()
                            }
                        })

                    }
                })
            }
            //HearthBeat
            else if (type == 1) {
                var token = data.readInt16LE(1)
                async.series(
                    [
                        (callabck) => {
                            if (checkValidToken(token)) {
                                async.setImmediate(callback)
                            }
                            else {
                                var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: 255, Timesatmp: new Date().getTime(), Content: "INVALID TOKEN?" + token })
                                message.save((err) => { callback(err) })
                            }
                        },
                        (callback) => {
                            database.Device.updateOne({ DeviceId: sender }, { DeviceActive: true }, (err) => { callback(err)})
                        },
                        (callback) => {
                            var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: type, Timesatmp: new Date().getTime(), Content: "HearthBeat, Token:"+token })
                            message.save((err) => { callback(err)})
                        }
                    ],
                    callback
                )
            }
            //current
            else if (type == 2) {
                var token = data.readInt16LE(1)
                var current = data.readFloatLE(3)
                async.series(
                    [
                        (callabck) => {
                            if (checkValidToken(token)) {
                                async.setImmediate(callback)
                            }
                            else {
                                var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: 255, Timesatmp: new Date().getTime(), Content: "INVALID TOKEN?" + token })
                                message.save((err) => { callback(err) })
                            }
                        },
                        (callback) => {
                            var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: type, Timesatmp: new Date().getTime(), Content: current.toString() })
                            message.save((err) => { callback(err) })
                        }
                    ],
                    callback
                )
                
            }
            //error
            else if (type == 3) {
                var token = data.readInt16LE(1)
                var errorCode = data.readInt8(3)
                //overcurrent
                if (errorCode == 0) {
                    async.series(
                        [
                            (callabck) => {
                                if (checkValidToken(token)) {
                                    async.setImmediate(callback)
                                }
                                else {
                                    var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: 255, Timesatmp: new Date().getTime(), Content: "INVALID TOKEN?" + token })
                                    message.save((err) => { callback(err) })
                                }
                            },
                            (callback) => {
                                database.Device.updateOne({ DeviceId: sender }, { PumpActive: false }, (err) => { callback(err) })
                            },
                            (callback) => {
                                var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: type, Timesatmp: new Date().getTime(), Content: "PUMP OVERCURRENT ERROR" })
                                message.save((err) => { callback(err) })
                            }
                        ],
                        callback
                    )
                }
                //undercurrent
                else if (errorCode == 1) {
                    async.series(
                        [
                            (callabck) => {
                                if (checkValidToken(token)) {
                                    async.setImmediate(callback)
                                }
                                else {
                                    var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: 255, Timesatmp: new Date().getTime(), Content: "INVALID TOKEN?" + token })
                                    message.save((err) => { callback(err) })
                                }
                            },
                            (callback) => {
                                var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: type, Timesatmp: new Date().getTime(), Content: "PUMP UNDERCURRENT ERROR" })
                                message.save((err) => { callback(err) })
                            }
                        ],
                        callback
,                    )
                    
                }
                //false current
                else if (errorCode == 2) {
                    async.series(
                        [
                            (callabck) => {
                                if (checkValidToken(token)) {
                                    async.setImmediate(callback)
                                }
                                else {
                                    var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: 255, Timesatmp: new Date().getTime(), Content: "INVALID TOKEN?" + token })
                                    message.save((err) => { callback(err) })
                                }
                            },
                            (callback) => {
                                var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: type, Timesatmp: new Date().getTime(), Content: "PUMP FALSE CURRENT ERROR" })
                                message.save((err) => { callback(err) })
                            }
                        ],
                        callback
                    )
                }
                //other error
                else if (errorCode == 3) {
                    async.series(
                        [
                            (callabck) => {
                                if (checkValidToken(token)) {
                                    async.setImmediate(callback)
                                }
                                else {
                                    var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: 255, Timesatmp: new Date().getTime(), Content: "INVALID TOKEN?" + token })
                                    message.save((err) => { callback(err) })
                                }
                            },
                            (callback) => {
                                var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: type, Timesatmp: new Date().getTime(), Content: "OTHER ERROR" })
                                message.save((err) => { callback(err) })
                            }
                        ],
                        callback
                    )
                }
                //unknown error
                else {
                    var message = new database.Message({ SenderId: sender, ReceiverId: receiver, Type: type, Timesatmp: new Date().getTime(), Content: "UNKNOWN ERROR" })
                    message.save((err) => { callback(err) })
                }
            }
            else {
                console.log("unknown message type: "+type)
                async.setImmediate(callback)
            }
        }
        async.waterfall(
            [
                getKey,
                decryptMessage,
                processMessage
            ],
            (err) => {
                if (err) { console.log(err)}
            }
        )
    }
   /* else if (code.includes("registertest")) {
        var msg = code.split(" ")[1];
        var devCode = msg.slice(2, 4)
        var encryptedHex = msg.slice(4)
        var encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);
        var aesCbc = new aesjs.ModeOfOperation.cbc(serverKey);
        var decryptedBytes = Buffer.from(aesCbc.decrypt(encryptedBytes))
        console.log(decryptedBytes.toString('hex'))
        console.log("to: ", msg.slice(0, 2))
        console.log("from: ", devCode)
        console.log("type: ", decryptedBytes.readInt8(0))
        console.log("passphrase: ", decryptedBytes.slice(1, 14).toString())
        createKeyFromPassphrase(parseInt(devCode, 16), decryptedBytes.slice(1, 14).toString(), (err, key) => {
            if (err) {
                console.log(err)
            }
            else {
                database.Device.findOne({ DeviceId: devCode }, (err, result) => {
                    if (!result) {
                        console.log("register " + devCode)
                        devices[devCode] = key
                        var device = new database.Device()
                        device['DeviceId'] = devCode;
                        device['DeviceKey'] = key.toString('hex')
                        device['DeviceActive'] = true;
                        device['PumpActive'] = false;
                        device['Lat'] = defaultLat;
                        device['Lng'] = defaultLng;
                        device.save((err) => { if (err) { console.log(err) } });
                    }
                    else {
                        console.log('already registered')
                    }
                })
                
            }
        })
    }*/
   /* else if (code.includes("aestest")) {
        var msg = code.split(" ")[1];
        var rec = msg.slice(0, 2)
        var devCode = msg.slice(2, 4)
        var encryptedHex = msg.slice(4)
        var encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);
        database.Device.findOne({ DeviceId: devCode }, (err, result) => {
            if (result) {
                var aesCbc = new aesjs.ModeOfOperation.cbc(Buffer.from(result.DeviceKey,'hex'));
                var decryptedBytes = Buffer.from(aesCbc.decrypt(encryptedBytes))
                console.log(decryptedBytes.toString('hex'))
                console.log("to: ", rec)
                console.log("from: ", devCode)
                console.log("type: ", decryptedBytes.readInt8(0))
                console.log("token: ", decryptedBytes.readInt16LE(1))
                console.log("current: ", decryptedBytes.readFloatLE(3))
                var message = new database.Message();
                message['SenderId'] = devCode
                message['ReceiverId'] = rec;
                message['Type'] = decryptedBytes.readInt8(0)
                message['Content'] = decryptedBytes.readFloatLE(3)
                message['Timestamp'] = new Date().getTime()
                message.save((err) => { if (err) { console.log(err) } });
            }
            else {
                console.log("device not registered: "+devCode)
            }

        })
    }*/
    else if (code.includes("BootCommand for 5s")) {
        if (initMode) {
            var passphrase = new Date().getTime().toString();
            var generateDeviceKey = (callback) => {
                createKeyFromPassphrase(deviceCode, passphrase, callback)
            }
            var createCommand = (deviceKey, callback) => {
                var devCodeHex = (deviceCode < 16) ? ("0" + deviceCode.toString(16)) : deviceCode.toString(16);
                var cmd = "init " + devCodeHex + " " + deviceKey.toString('hex') + " " + serverKey.toString('hex') + " " + passphrase
                console.log(cmd)
                async.setImmediate(callback, null, cmd)
            }
            var sendCommand = (cmd, callback) => {
                serialport.write(cmd)
                async.setImmediate(callback)
            }
            async.waterfall(
                [
                    generateDeviceKey,
                    createCommand,
                    sendCommand
                ],
                (err) => {
                    initMode = false;
                    if (err) { console.log(err) }
                    else { console.log("init success") }
                }
            )
        }
    }
}

var addLineParser = (callback) => {
    const parser = serialport.pipe(new Readline({ delimiter: '\r\n' }));
    parser.on('data', (chunk) => {
        console.log("->" + chunk)
        processSerial(chunk)

    });
    async.setImmediate(callback)
}
var init = (callback) => {
    async.series(
        [
            initServer,
            lookupPort,
            openSerial,
            addLineParser
        ],
        (err) => {
            if (!err) {
                console.log("Serial listening on port: " + port.comName)
            }
            callback(err)
        }
    )
}

var deviceInit = (deviceId, callback) => {
    deviceCode = deviceId;
    initMode = true;
    async.series(
        [
            (callback) => {
                if (serialport) {
                    serialport.close(callback);
                }
                else {
                    async.setImmediate(callback)
                }
            },
            init
        ],
        callback
    )
}
var sendToken = () => {
    var buf = Buffer.alloc(16);
    buf.writeInt8(0, 0);
    buf.writeInt16LE(Math.round(new Date().getTime()/1000),1);
    var aesCbc = new aesjs.ModeOfOperation.cbc(serverKey);
    var encryptedBytes = aesCbc.encrypt(buffer);
    var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    cmdBuffer.push("send 0001" + encryptedHex);
}
var turnOnPump = (device) => {
    var buf = Buffer.alloc(16);
    buf.writeInt8(2, 0);
    buf.writeInt8(1, 1);
    var aesCbc = new aesjs.ModeOfOperation.cbc(Buffer.from(device.DeviceKey, 'hex'));
    var encryptedBytes = aesCbc.encrypt(buffer);
    var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    cmdBuffer.push("send " + device.DeviceId + "01" + encryptedHex);
}
var turnOffPump = (device) => {
    var buf = Buffer.alloc(16);
    buf.writeInt8(2, 0);
    buf.writeInt8(0, 1);
    var aesCbc = new aesjs.ModeOfOperation.cbc(Buffer.from(device.DeviceKey, 'hex'));
    var encryptedBytes = aesCbc.encrypt(buffer);
    var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    cmdBuffer.push("send " + device.DeviceId + "01" + encryptedHex);
}
var turnOnLed = (device) => {
    var buf = Buffer.alloc(16);
    buf.writeInt8(1, 0);
    buf.writeInt8(1, 1);
    var aesCbc = new aesjs.ModeOfOperation.cbc(Buffer.from(device.DeviceKey, 'hex'));
    var encryptedBytes = aesCbc.encrypt(buffer);
    var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    cmdBuffer.push("send " + device.DeviceId + "01" + encryptedHex);
}
var turnOffLed = (device) => {
    var buf = Buffer.alloc(16);
    buf.writeInt8(1, 0);
    buf.writeInt8(0, 1);
    var aesCbc = new aesjs.ModeOfOperation.cbc(Buffer.from(device.DeviceKey, 'hex'));
    var encryptedBytes = aesCbc.encrypt(buffer);
    var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    cmdBuffer.push("send " + device.DeviceId + "01" + encryptedHex);
}
var setMaxCurrent = (value,device) => {
    var buf = Buffer.alloc(16);
    buf.writeInt8(3, 0);
    buf.writeFloatLE(value, 1);
    if (device) {
        var aesCbc = new aesjs.ModeOfOperation.cbc(Buffer.from(device.DeviceKey, 'hex'));
        var encryptedBytes = aesCbc.encrypt(buffer);
        var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
        cmdBuffer.push("send "+device.DeviceId+"01" + encryptedHex);
    }
    else {
        var aesCbc = new aesjs.ModeOfOperation.cbc(serverKey);
        var encryptedBytes = aesCbc.encrypt(buffer);
        var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
        cmdBuffer.push("send 0001" + encryptedHex);
    }
}
var setMinCurrent = (value, device) => {
    var buf = Buffer.alloc(16);
    buf.writeInt8(4, 0);
    buf.writeFloatLE(value, 1);
    if (device) {
        var aesCbc = new aesjs.ModeOfOperation.cbc(Buffer.from(device.DeviceKey, 'hex'));
        var encryptedBytes = aesCbc.encrypt(buffer);
        var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
        cmdBuffer.push("send " + device.DeviceId + "01" + encryptedHex);
    }
    else {
        var aesCbc = new aesjs.ModeOfOperation.cbc(serverKey);
        var encryptedBytes = aesCbc.encrypt(buffer);
        var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
        cmdBuffer.push("send 0001" + encryptedHex);
    }
}

var checkActiveDevices = (callback) => {
    var limit = new Date().getTime() - 60 * 60 * 1000
    database.Device.find({}, (err, result) => {
        if (err) {
            callback(err)
        }
        else {
            async.each(
                result,
                (device, callback) => {
                    database.Message.find(
                        { SenderId: device.DeviceId, Type: 1 },
                        {
                            sort: {
                                Timesatmp: -1 //Sort DESC
                            }
                        },
                        (err, result) => {
                            if (err) { console.log(err) }
                            else {
                                if (result.length > 0) {
                                    if (result.Timesatmp < limit) {
                                        database.Device.updateOne({ DeviceId: device.DeviceId }, { DeviceActive: false }, (err) => {
                                            if (err) { console.log(err) }
                                            callback()
                                        })
                                    }
                                    else {
                                        database.Device.updateOne({ DeviceId: device.DeviceId }, { DeviceActive: true }, (err) => {
                                            if (err) { console.log(err) }
                                            callback()
                                        })
                                    }
                                }
                                else {
                                    database.Device.updateOne({ DeviceId: device.DeviceId }, { DeviceActive: false }, (err) => {
                                        if (err) { console.log(err) }
                                        callback()
                                    })
                                }
                            }
                        }
                    )
                },
                (err) => {
                    callback(err)
                }
            )
        }
    })
}

var checkValidToken = function (token) {
    var limit = Math.round(new Date().getTime() / 1000) - 60 * 60 //elmúlt 1 óra
    return (token > limit);
}

module.exports = {
    init: init,
    deviceInit: deviceInit,
    sendToken: sendToken,
    checkActiveDevies: checkActiveDevices,
    turnOnLed: turnOnLed,
    turnOffLed: turnOffLed,
    turnOnPump: turnOnPump,
    turnOffPump: turnOffPump,
    setMaxCurrent: setMaxCurrent,
    setMinCurrent: setMinCurrent
}


