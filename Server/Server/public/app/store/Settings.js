Ext.define('PumpContolFront.store.Settings', {
    extend: 'Ext.data.Store',

    alias: 'store.settings',
    model: 'PumpContolFront.model.Setting',
    autoLoad: true,
    autoSync: true,
    proxy: {
        type: 'rest',
        url: 'setting',
        reader: {
            type: 'json',
            rootProperty: 'data'
        },
        writer: {
            type: 'json'
        },
        extraParams: {
            where: JSON.stringify({})
        },
        listeners: {
            exception: function (proxy, response, operation, eOpts) {
                var records = operation.getRecords()
                if (records) {
                    for (var i in records) {
                        if (response.request.action == "create") {
                            records[i].drop()
                        }
                        else {
                            records[i].reject()
                        }
                    }
                }
                Ext.toast({
                    html:response.status+":"+response.statusText,
                    title: 'Server Error',
                    width: 200,
                    height: 100,
                    align: 'bl'
                });
            }
        }
    }
});
