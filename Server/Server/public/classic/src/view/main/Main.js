/**
 * This class is the main view for the application. It is specified in app.js as the
 * "mainView" property. That setting automatically applies the "viewport"
 * plugin causing this view to become the body element (i.e., the viewport).
 *
 * TODO - Replace this content of this view to suite the needs of your application.
 */
Ext.define('PumpContolFront.view.main.Main', {
    extend: 'Ext.tab.Panel',
    xtype: 'app-main',

    requires: [
        'Ext.plugin.Viewport',
        'Ext.window.MessageBox',

        'PumpContolFront.view.main.MainController',
        'PumpContolFront.view.main.MainModel',
        'PumpContolFront.view.main.SupervisorPanel',
        'PumpContolFront.view.main.SettingsPanel',
        'PumpContolFront.view.main.BootloaderPanel'
    ],

    controller: 'main',
    viewModel: 'main',

    ui: 'navigation',

    tabBarHeaderPosition: 1,
    titleRotation: 0,
    tabRotation: 0,

    header: {
        layout: {
            align: 'stretchmax'
        },
        title: {
            bind: {
                text: '{name}'
            },
            flex: 0
        },
        iconCls: 'fa-th-list'
    },

    tabBar: {
        flex: 1,
        layout: {
            align: 'stretch',
            overflowHandler: 'none'
        }
    },

    responsiveConfig: {
        tall: {
            headerPosition: 'top'
        },
        wide: {
            //headerPosition: 'left'
            headerPosition: 'top'
        }
    },

    defaults: {
        bodyPadding: 20,
        tabConfig: {
            plugins: 'responsive',
            responsiveConfig: {
                wide: {
                    iconAlign: 'left',
                    textAlign: 'left'
                },
                tall: {
                    iconAlign: 'top',
                    textAlign: 'center',
                    width: 120
                }
            }
        }
    },
    defaults: {
        layout:'fit'
    },
    items: [
        {
            title: 'Supervisor',
            iconCls: 'fa-home',
            items: [{
                xtype: 'supervisorpanel'
            }]
        },

        {
            title: 'Settings',
            iconCls: 'fa-cog',
            items: [{
                xtype: 'settingspanel'
            }]
        },
        {
            title: 'BootLoader',
            iconCls: 'fa-user',
            items: [{
                xtype: 'bootloaderpanel'
            }]
        }
    ]
});
