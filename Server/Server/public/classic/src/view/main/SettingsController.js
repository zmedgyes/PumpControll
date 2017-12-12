Ext.define('PumpContolFront.view.main.SettingsController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.settings',
    init: function () {
        var controller = this;
        var view = controller.getView();
    },
    onAddClick: function () {
        var controller = this;
        var grid = controller.getView()

        var records = grid.store.add({})
        var plugin = grid.findPlugin('rowediting')
        plugin.startEdit(records[0])
    },
    onRemoveClick: function () {
        var controller = this;
        var grid = controller.getView();
        var selection = grid.getSelection()
        for (var i in selection) {
            grid.store.remove(selection[i])
        }
    },
    onSelectionChange: function () {
        var controller = this;
        var grid = controller.getView();
        var selection = grid.getSelection()
        var button = controller.lookupReference('removeSetting')
        button.setDisabled((selection.length>0)?false:true)
    }
});
