var async = require('async');
var SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;
var aesjs = require('aes-js');
const crypto = require('crypto');

var port;
var serialport;
var cmdBuffer = ["send 060001"]


var key_128 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

var serverPsw = "server";
var serverCode = 1;
var serverKey;

var initMode = false;
var deviceCode = 33;
var devices = {}


var initServer = (callback) => {
    createKeyFromPassphrase(1, "server", (err, key) => {
        if (err) { callback(err) }
        else {
            serverKey = key;
            callback();
        }
        console.log("SERVERKEY: " +serverKey.toString('hex'));
    })
    /*crypto.pbkdf2(serverPsw, serverCode.toString(16), 100000, 16, 'sha512', (err, derivedKey) => {
        if (err) { callback(err) }
        else {
            serverKey = derivedKey;
            callback();
        }
        console.log("SERVERKEY: "+derivedKey.toString('hex'));  // '3745e48...08d59ae'
    });*/
}
var createKeyFromPassphrase = (code,passphrase, callback) => {
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
            async.setImmediate(callback,new Error("no fitting port found"))
        }
    });
}
var openSerial = (callback) => {
    var options = {
        baudRate: 57600,
        dataBits:8,
        stopBits:1,
        parity: "none"
    }
    serialport = new SerialPort(
        port.comName,
        options,
        callback
    )
}

var processCommand = (code) => {
    if (code.includes("getbufferlength")) {
        serialport.write(cmdBuffer.length.toString())
    }
    else if (code.includes("getnext")) {
        serialport.write(cmdBuffer[0])
    }
    else if (code.includes("radio_rx")) {
        var hex = code.split(" ")[2]
        var buf = new Buffer(hex, "hex")
        console.log("to: " + buf.readInt8(0))
        console.log("from: " + buf.readInt8(1))
        var type = buf.readInt8(2)
        console.log("type: " + type)
        if (type == 2) {
            console.log("Amps: " + buf.readFloatBE(3))
        }

    }
    else if (code.includes("registertest")) {
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
                console.log("register "+devCode)
                devices[devCode] = key
            }
        })
        devices[msg.slice(2, 4)]
    }
    else if (code.includes("aestest")) {
        var msg = code.split(" ")[1];
        var devCode = msg.slice(2, 4)
        if (devices[devCode]) {
            var encryptedHex = msg.slice(4)
            var encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);
            var aesCbc = new aesjs.ModeOfOperation.cbc(devices[devCode]);
            var decryptedBytes = Buffer.from(aesCbc.decrypt(encryptedBytes))
            console.log(decryptedBytes.toString('hex'))
            console.log("to: ", msg.slice(0, 2))
            console.log("from: ", devCode)
            console.log("type: ", decryptedBytes.readInt8(0))
            console.log("token: ", decryptedBytes.readInt16LE(1))
            console.log("current: ", decryptedBytes.readFloatLE(3))
        }
        else {
            console.log(devCode+" not registered")
        }
    }
    else if (code.includes("BootCommand for 5s")) {
        if (initMode) {
            var passphrase = new Date().getTime().toString();
            var generateDeviceKey = (callback) => {
                createKeyFromPassphrase(deviceCode, passphrase,callback)
            }
            var createCommand = (deviceKey, callback) => {
                var cmd = "init " + deviceCode.toString(16) + " " + deviceKey.toString('hex') + " " + serverKey.toString('hex') + " " + passphrase
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
                    if (err) { console.log(err) }
                    else { console.log("init success")}
                }
            )
        }
    }
}

var addLineParser = (callback) => {
    const parser = serialport.pipe(new Readline({ delimiter: '\r\n' }));
    parser.on('data', (chunk) => {
        console.log("->"+chunk)
        processCommand(chunk)
        
    });
    async.setImmediate(callback)
}
async.series(
    [
        initServer,
        lookupPort,
        openSerial,
        addLineParser
    ],
    (err) => {
        if (err) {
            console.log(err)
        }
        else {
            console.log("listening on port: "+port.comName)
        }
    }
)

