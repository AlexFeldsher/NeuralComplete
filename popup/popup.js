document.addEventListener('DOMContentLoaded', function(e) {
    browser.storage.local.get().then(function (data) {
        if (data == undefined) {
            browser.storage.local.set({status: 'enabled'});

            browser.browserAction.setIcon({
                path: {
                    48: '../icons/enabled.svg'
                }
            });
        } else if (data.status === 'disabled') {
            let disable_button = document.getElementById('disable');
            let enable_button = document.getElementById('enable');
            disable_button.hidden = true;
            enable_button.hidden = false;

            browser.browserAction.setIcon({
                path: {
                    48: '../icons/disabled.svg'
                }
            });

        }
    });
});

document.getElementById('open_settings').addEventListener('click', function(e) {
    browser.tabs.create({url: '../settings/settings.html'});
});

document.getElementById('disable').addEventListener('click', function() {
    browser.storage.local.set({ status: 'disabled' });
    browser.runtime.sendMessage({
        type: 'statusChange',
        status: 'disabled'
    });  // notify the background script 
    browser.browserAction.setIcon({
        path: {
            48: '../icons/disabled.svg'
        }
    });
});

document.getElementById('enable').addEventListener('click', function() {
    browser.storage.local.set({ status: 'enabled' });
    browser.runtime.sendMessage({
        type: 'statusChange',
        status: 'enabled'
    });   // notify the background script
    browser.browserAction.setIcon({
        path: {
            48: '../icons/enabled.svg'
        }
    });
});
