Ext.define('PumpContolFront.view.main.SupervisorController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.supervisor',
    onMapReady: function (panel, gmap) {
        var controller = this;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                var pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                gmap.setCenter(pos);
            })
        }
       /* Ext.Ajax.request({
            method: 'POST',
            url: 'getDevices',
            jsonData: {},
            success: function (response, opts) {
                var msg = JSON.parse(response.responseText)
                if (msg.data) {
                    for (var i in msg.data) {
                        controller.addMarker(msg.data[i])
                    }
                }
            },

            failure: function (response, opts) {
                console.log('server-side failure with status code ' + response.status);
            }
        });*/
    },
    addMarker: function (lamp) {
        var controller = this;
        var mapPanel = controller.lookupReference('gmap')
        if (!lamp.position) { lamp.position = mapPanel.gmap.getCenter() }
        var marker = new google.maps.Marker({
            position: lamp.position,
            map: mapPanel.gmap,
            title: lamp.deviceId,
            draggable: true
        });

        //marker.addListener('drag', handleEvent);
        marker.addListener('dragend', function (event) {
            var position = {
                lat: event.latLng.lat(),
                lng: event.latLng.lng()
            }
            controller.updateMarkerPosition(lamp.deviceId, position)
        });
        marker.addListener('click', function (event) {

            Ext.Ajax.request({
                method: 'POST',
                url: 'getDevices',
                jsonData: {
                    deviceId: lamp.deviceId
                },
                success: function (response, opts) {
                    var msg = JSON.parse(response.responseText)
                    var str = ""
                    if (msg.data) {
                        for (var i in msg.data) {
                            str += "DeviceId: " + msg.data[i].deviceId + "<br>"
                            str += "CurrentSetup: " + (100 * (msg.data[i].currentBrightness) / 1024) + "%<br>"
                            str += "Environment: " + (100 * (1024 - msg.data[i].environmentBrightness) / 1024) + "%<br>"
                            str += "Connected: " + msg.data[i].connected + "<br>"
                        }
                        Ext.Msg.alert('Status', str);
                    }
                },
                failure: function (response, opts) {
                    console.log('server-side failure with status code ' + response.status);
                }
            });
        });
    },
    updateMarkerPosition: function (devId, position) {
        var controller = this;
        Ext.Ajax.request({
            method: 'POST',
            url: 'updateDevicePosition',
            jsonData: {
                deviceId: devId,
                position: position
            },
            success: function (response, opts) {
                console.log(response.responseText)
                controller.onTest(devId)
            },

            failure: function (response, opts) {
                console.log('server-side failure with status code ' + response.status);
            }
        });
    },
    onTest: function (deviceId) {
        var controller = this;
        var now = new Date().getTime()
        Ext.Ajax.request({
            url: '/devicetest',
            method: 'POST',
            jsonData: {
                deviceId: deviceId,
                from: now,
                to: now + 10 * 1000,
                value: 1023
            },
            success: function (transport) {
                // do something
            },
            failure: function (transport) {
                alert("Error: " - transport.responseText);
            }
        });
    }
});
