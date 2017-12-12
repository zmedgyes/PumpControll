Ext.define('PumpContolFront.view.main.SettingsPanel', {
    extend: 'Ext.grid.Panel',
    xtype: 'settingspanel',

    requires: [
        'PumpContolFront.view.main.SettingsController'
    ],

    controller: 'settings',
    title: 'Settings',
    store: {
        type: 'settings'
    },

    plugins: [{
        ptype: 'rowediting',
        clicksToMoveEditor: 1,
        clicksToEdit:2,
        autoCancel: false
    }],

    columns: [
        {
            header: 'Name',
            dataIndex: 'Name',
            width: 100,
            flex: 1,
            dirtyText: 'Name has been edited',
            editor: {
                // defaults to textfield if no xtype is supplied
                xtype:'textfield',
                allowBlank: false
            }
        },
        {
            header: 'Value',
            dataIndex: 'Value',
            width: 100,
            flex: 1,
            dirtyText: 'Value has been edited',
            editor: {
                // defaults to textfield if no xtype is supplied
                xtype:'textfield',
                allowBlank: false
            }
        }
    ],

    tbar: [
        {
            text: 'Add Setting',
            handler: 'onAddClick'
        },
        {
            text: 'Remove Setting',
            reference: 'removeSetting',
            handler: 'onRemoveClick',
            disabled: true
        }
    ],

    listeners: {
        selectionchange: 'onSelectionChange',
        afterrender:'init'
    }
});
