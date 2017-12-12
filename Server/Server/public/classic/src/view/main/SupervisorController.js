Ext.define('PumpContolFront.view.main.SupervisorController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.supervisor',
    init: function () {
        var controller = this;
        var view = controller.getView();
        view['markers'] = {}
        view['pollInterval'] = setInterval(function () {
            controller.onPoll()
        }, 1000);
    },
    onPoll: function () {
        var controller = this;
        var view = controller.getView()
        var deviceGrid = controller.lookupReference('devicegrid')
        deviceGrid.store.load({
            callback: function (records) {
                for (var i in records) {
                    controller.addMarker(records[i])
                }
                for (var i in view.markers) {
                    var found = false;
                    for (var j in records) {
                        if (records[j].get('DeviceId') == i) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        view.markers[i].setMap(null)
                        delete view.markers[i]
                    }
                }
            }
        });
        var messageGrid = controller.lookupReference('messagegrid')
        var selectedDevices = deviceGrid.getSelection()
        if (selectedDevices.length > 0) {
            messageGrid.store.load({
                params: {
                    where: JSON.stringify({
                        SenderId: selectedDevices[0].get('DeviceId')
                    })
                }
            });
        }
        else {
            messageGrid.store.load({
                params: {
                    where: JSON.stringify({})
                }
            });
        }
    },
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
    },
    addMarker: function (device) {
        var controller = this;
        var view = controller.getView();
        var mapPanel = controller.lookupReference('mappanel')
        if (view.markers.hasOwnProperty(device.get('DeviceId'))) {
            //set new Position
            var marker = view.markers[device.get('DeviceId')]
            var currentPos = marker.getPosition() 
            var newPos = new google.maps.LatLng(device.get('Lat'), device.get('Lng'));
   
            if (currentPos.lat() != newPos.lat() || currentPos.lng() != newPos.lng()) {
                if (!marker.isDragging) {
                    marker.setPosition(newPos)
                }
            }
            
        }
        else {
            var marker = new google.maps.Marker({
                position: new google.maps.LatLng(device.get('Lat'), device.get('Lng')),
                map: mapPanel.gmap,
                title: "DeviceId: "+device.get('DeviceId'),
                draggable: true
            });

            //marker.addListener('drag', handleEvent);
            marker.addListener('dragstart', function (event) {
                marker['isDragging'] = true;
            });
            marker.addListener('dragend', function (event) {
                var locDevice = controller.lookupReference('devicegrid').store.findRecord('DeviceId',device.get('DeviceId'))
                if (locDevice) {
                    locDevice.beginEdit()
                    locDevice.set('Lat', event.latLng.lat())
                    locDevice.set('Lng', event.latLng.lng())
                    locDevice.endEdit()
                }
                marker['isDragging'] = false;
            });
            marker.addListener('click', function (event) {
                var deviceGrid = controller.lookupReference('devicegrid')
                var locDevice = deviceGrid.store.findRecord('DeviceId', device.get('DeviceId'))
                deviceGrid.setSelection(locDevice)
            });
            view.markers[device.get('DeviceId')] = marker;
        }
    },
    onDateRender: function (value, metaData, record) {
        return new Date(value).toLocaleString()
    },
    onMessageTypeRender: function (value, metaData, record) {
        if (value == 2) {
            return "Irms (A)"
        }
        else {
            return value;
        }
    },
    onMessageContentRender: function (value, metaData, record) {
        if (record.get('Type') == 2) {
            return parseFloat(value).toFixed(1)
        }
        else {
            return value
        }
    }
});
