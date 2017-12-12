Ext.define('PumpContolFront.view.main.BootloaderController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.bootloader',
    init: function () {
        var controller = this;
        var view = controller.getView();
    },
    onStartClick: function () {
        var controller = this;
        var field = controller.lookupReference('devId')
        var value = field.getValue()
        if (field.isValid() && value != null) {
            
            Ext.toast({
                html: 'Bootloader started on device: ' + value,
                title: 'Bootloader',
                width: 200,
                height:100,
                align: 'bl'
            });
            Ext.Ajax.request({
                method: 'POST',
                url: 'bootloader',
                jsonData: {
                    DeviceId: value
                },
                success: function (response, opts) {
                    var msg = JSON.parse(response.responseText)
                    if (msg.success) {
                        Ext.toast({
                            html: 'Bootloader succeeded on device: ' + value,
                            title: 'Bootloader',
                            width: 200,
                            height: 100,
                            align: 'bl'
                        });
                    }
                    else {
                        Ext.toast({
                            html: 'Bootloader failed on device: ' + value + '<br> Error: ' + msg.error,
                            title: 'Bootloader',
                            width: 200,
                            height: 100,
                            align: 'bl'
                        });
                    }
                },

                failure: function (response, opts) {
                    Ext.toast({
                        html: 'server-side failure with status code ' + response.status,
                        title: 'Bootloader',
                        width: 200,
                        height: 100,
                        align: 'bl'
                    });
                }
            });
        }
        else {
            Ext.toast({
                html: 'DeviceId not valid! (must be between 2 and 255)',
                title: 'Bootloader',
                width: 200,
                align: 'bl'
            });
        }
    }
});
