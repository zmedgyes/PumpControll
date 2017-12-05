var deviceControl = require('./deviceControl.js')
var database = require('./database.js')
var async = require('async')

var express = require('express')
var bodyParser = require('body-parser');
var app = express()
var port = 3000

app.use(express.static('public'))

app.get('/message', (req, res) => {
    database.Message.find(req.query, (err, data) => {
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
    database.Device.find(req.query, (err, data) => {
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
app.put('/device', bodyParser.json(), (req, res) => {
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

async.series(
    [
        (callback) => {
            database.init(callback)
        },
        (callback) => {
            deviceControl.init(callback)
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
