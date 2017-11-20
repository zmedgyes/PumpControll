var async = require('async');
var SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;

var port;
var serialport;
var cmdBuffer = ["send 060001"]


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
            console.log("Amps: "+buf.readFloatBE(3))
        }

    }
}

var addLineParser = (callback) => {
    const parser = serialport.pipe(new Readline({ delimiter: '\r\n' }));
    parser.on('data', (chunk) => {
        console.log(chunk)
        processCommand(chunk)
        
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

