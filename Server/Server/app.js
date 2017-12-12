var deviceControl = require('./deviceControl.js')
var database = require('./database.js')
var async = require('async')

var express = require('express')
var bodyParser = require('body-parser');
var app = express()
var port = 3000

app.use(express.static('public'))

app.get('/message', (req, res) => {
    var where = {}
    if (req.query.where) {
        where = JSON.parse(req.query.where)
    }
    database.Message.find(where, (err, data) => {
        res.setHeader('Content-Type', 'application/json')
        if (err) {
            res.write(JSON.stringify({ success: false, error: err }))

        }
        else {
            res.write(JSON.stringify({ success: true, data: data }))
        }
        res.end()
    })
})
app.get('/device', (req, res) => {
    var where = {}
    if (req.query.where) {
        where = JSON.parse(req.query.where)
    }
    database.Device.find(where, (err, data) => {
        res.setHeader('Content-Type', 'application/json')
        if (err) {
            res.write(JSON.stringify({ success: false, error: err }))

        }
        else {
            res.write(JSON.stringify({ success: true, data: data }))
        }
        res.end()
    })
})
app.put('/device/*', bodyParser.json(), (req, res) => {
    async.waterfall(
        [
            (callback) => {
                var id = req.body['_id']
                delete req.body['_id']
                database.Device.updateOne({ _id: id }, req.body, callback)
            }
        ],
        (err, data) => {
            res.setHeader('Content-Type', 'application/json')
            if (err) {
                res.write(JSON.stringify({ success: false, error: err }))
            }
            else {
                res.write(JSON.stringify({ success: true, data: data }))
            }
            res.end()
        }
    )
})
app.delete('/device/*', bodyParser.json(), (req, res) => {
    async.waterfall(
        [
            (callback) => {
                var id = req.body['_id']
                delete req.body['_id']
                database.Device.remove({ _id: id }, callback)
            }
        ],
        (err, data) => {
            res.setHeader('Content-Type', 'application/json')
            if (err) {
                res.write(JSON.stringify({ success: false, error: err }))
            }
            else {
                res.write(JSON.stringify({ success: true, data: data }))
            }
            res.end()
        }
    )
})
app.get('/setting', (req, res) => {
    var where = {}
    if (req.query.where) {
        where = JSON.parse(req.query.where)
    }
    database.Setting.find(where, (err, data) => {
        res.setHeader('Content-Type', 'application/json')
        if (err) {
            res.write(JSON.stringify({ success: false, error: err }))

        }
        else {
            res.write(JSON.stringify({ success: true, data: data }))
        }
        res.end()
    })
})
app.post('/setting', bodyParser.json(), (req, res) => {
    async.waterfall(
        [
            (callback) => {
                delete req.body['_id']
                var setting = new database.Setting(req.body) 
                setting.save(callback)
            }
        ],
        (err, data) => {
            res.setHeader('Content-Type', 'application/json')
            if (err) {
                res.write(JSON.stringify({ success: false, error: err }))
            }
            else {
                res.write(JSON.stringify({ success: true, data: data }))
            }
            res.end()
        }
    )
})
app.put('/setting/*', bodyParser.json(), (req, res) => {
    async.waterfall(
        [
            (callback) => {
                var id = req.body['_id']
                delete req.body['_id']
                database.Setting.updateOne({ _id: id }, req.body, callback)
            }
        ],
        (err, data) => {
            res.setHeader('Content-Type', 'application/json')
            if (err) {
                res.write(JSON.stringify({ success: false, error: err }))
            }
            else {
                res.write(JSON.stringify({ success: true, data: data }))
            }
            res.end()
        }
    )
})
app.delete('/setting/*', bodyParser.json(), (req, res) => {
    async.waterfall(
        [
            (callback) => {
                var id = req.body['_id']
                delete req.body['_id']
                database.Setting.remove({ _id: id }, callback)
            }
        ],
        (err, data) => {
            res.setHeader('Content-Type', 'application/json')
            if (err) {
                res.write(JSON.stringify({ success: false, error: err }))
            }
            else {
                res.write(JSON.stringify({ success: true, data: data }))
            }
            res.end()
        }
    )
})
app.post('/bootloader', bodyParser.json(), (req, res) => {
    /*async.waterfall(
        [
            (callback) => {
                delete req.body['_id']
                database.Setting.insertOne(req.body, callback)
            }
        ],
        (err, data) => {
            res.setHeader('Content-Type', 'application/json')
            if (err) {
                res.write(JSON.stringify({ success: false, error: err }))
            }
            else {
                res.write(JSON.stringify({ success: true, data: data }))
            }
            res.end()
        }
    )*/
    res.write(JSON.stringify({ success: false, error: "function not initiated" }))
    res.end()
})

async.series(
    [
        (callback) => {
            database.init(callback)
        },
        (callback) => {
            deviceControl.init((err) => {
                console.log(err)
                callback()
            })
        },
        (callback) => {
            app.listen(port, (err) => {
                if (!err) {
                    console.log('WebServer listening on port ' + port)
                }
                callback(err)
            })
        }
    ],
    (err) => {
        if (err) {
            console.log(err)
        }
    }
)
