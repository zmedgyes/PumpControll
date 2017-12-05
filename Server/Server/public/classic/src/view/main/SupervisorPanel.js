/**
 * This view is an example list of people.
 */
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
        type: "hbox",
        align:"stretch"
    },
    items: [
        {
            xtype: 'gmappanel',
            reference: "mappanel",
            flex: 3,
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
            flex: 1,
            layout: {
                type: "vbox",
                align: "stretch"
            },
            items: [
                {
                    xtype: "grid",
                    flex: 1,
                    reference: "devicegrid",
                    title:"Devices"
                },
                {
                    xtype: "grid",
                    flex: 1,
                    reference: "messagegrid",
                    title:"Messages"
                }
            ]
        }
    ]
});
