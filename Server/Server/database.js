var async = require('async')
var mongoose = require('mongoose')
//mongod --port 27017 --dbpath D:\mongodb\data\db
var url = 'mongodb://localhost/pumpcontrol'

var deviceSchema = new mongoose.Schema({
    DeviceId: Number,
    DeviceKey: String,
    Lat: Number,
    Lng: Number,
    DeviceActive: Boolean,
    PumpActive: Boolean
});
var messageSchema = new mongoose.Schema({
    SenderId: Number,
    ReceiverId: Number,
    Type: Number,
    Content: String,
    Timestamp: Number
});
var settingSchema = new mongoose.Schema({
    Name: String,
    Value: String
});


var deviceModel = mongoose.model('Device', deviceSchema)
var messageModel = mongoose.model('Message', messageSchema)
var settingModel = mongoose.model('Setting', settingSchema)

var init = (callback) => {
    mongoose.connect(url, { useMongoClient: true }, (err) => {
        if (!err) {
            console.log('Connected to MongoDB')
        }
        callback(err)
    });
}

module.exports = {
    Device: deviceModel,
    Message: messageModel,
    Setting: settingModel,
    init:init
}