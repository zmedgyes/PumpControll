var async = require('async');
var SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;

var port;
var serialport;
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
var addLineParser = (callback) => {
    const parser = serialport.pipe(new Readline({ delimiter: '\r\n' }));
    parser.on('data', (chunk) => {
        console.log(chunk)
        if (chunk.includes("check")) {
            serialport.write("mycmd")
        }
    });
    async.setImmediate(callback)
}

async.series(
    [
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

