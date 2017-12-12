Ext.define('PumpContolFront.model.Message', {
    extend: 'Ext.data.Model',
    idProperty: '_id',
    fields: [
        '_id',
        'SenderId',
        'ReceiverId',
        'Type',
        'Content',
        'Timestamp'
    ]
});