Ext.define('PumpContolFront.view.main.BootloaderPanel', {
    extend: 'Ext.form.Panel',
    xtype: 'bootloaderpanel',

    requires: [
        'PumpContolFront.view.main.BootloaderController',
    ],

    controller: 'bootloader',
    title: 'BootLoader',
    items: [
        {
            xtype: 'numberfield',
            reference: 'devId',
            fieldLabel: 'DeviceId',
            maxValue: 255,
            minValue: 2
        },
        {
            xtype: 'button',
            text: 'Start',
            handler: 'onStartClick'
        }
    ],
    listeners: {
        afterrender: 'init'
    }
});
