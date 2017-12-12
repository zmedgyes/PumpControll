Ext.define('PumpContolFront.view.main.SupervisorPanel', {
    extend: 'Ext.panel.Panel',
    xtype: 'supervisorpanel',

    requires: [
        'PumpContolFront.view.main.SupervisorController',
        'Ext.ux.GMapPanel'
    ],

    controller: 'supervisor',
    title: 'Supervisor',
    layout: {
        type: "border",
        align: "stretch"
    },
    items: [
        {
            xtype: 'gmappanel',
            reference: "mappanel",
            flex: 3,
            region: 'center',
            gmapType: 'map',
            //"0"km kõ
            center: {
                lat: 47.4983792,
                lng: 19.0402202
            },
            mapOptions: {
                mapTypeId: google.maps.MapTypeId.ROADMAP
            },
            listeners: {
                mapready: 'onMapReady'
            }
        },
        {
            flex: 2,
            layout: {
                type: "vbox",
                align: "stretch"
            },
            region: 'east',
            split: true,
            items: [
                {
                    xtype: "grid",
                    flex: 1,
                    reference: "devicegrid",
                    title: "Devices",
                    store: {
                        type: 'devices',
                        autoSync: true
                    },
                    //store: 'Devices',
                    viewConfig: {
                        loadMask: false
                    },
                    columns: [
                        {
                            text: 'DeviceId',
                            dataIndex: 'DeviceId',
                            flex: 1
                        },
                        {
                            xtype: 'checkcolumn',
                            text: 'Device State',
                            dataIndex: 'DeviceActive'
                        },
                        {
                            xtype: 'checkcolumn',
                            text: 'Pump State',
                            dataIndex: 'PumpActive'
                        }
                    ]
                },
                {
                    xtype: "grid",
                    flex: 1,

                    reference: "messagegrid",
                    title: "Messages",
                    store: {
                        type:'messages'
                    },
                    viewConfig: {
                        loadMask: false
                    },
                    columns: [
                        {
                            text: 'Timestamp',
                            dataIndex: 'Timestamp',
                            renderer:'onDateRender',
                            flex: 1
                        },
                        {
                            text: 'SenderId',
                            dataIndex: 'SenderId',
                            flex: 1
                        },
                        {
                            text: 'ReceiverId',
                            dataIndex: 'ReceiverId',
                            flex: 1
                        },
                        {
                            text: 'Type',
                            dataIndex: 'Type',
                            renderer:'onMessageTypeRender',
                            flex: 1
                        },
                        {
                            text: 'Content',
                            dataIndex: 'Content',
                            renderer:'onMessageContentRender',
                            flex: 1
                        }
                    ]
                }
            ]
        }
    ],
    listeners: {
        afterrender:'init'
    }
});
