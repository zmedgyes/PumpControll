Ext.define('PumpContolFront.model.Device', {
    extend: 'Ext.data.Model',
    idProperty:'_id',
    fields: [
        '_id',
        'DeviceId',
        'Lat',
        'Lng',
        'DeviceActive',
        'PumpActive'
    ]
});