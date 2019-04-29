// Global variables
let gStatus = "enabled";
let gLastWord = '';
var gNnet = new brain.recurrent.LSTM();
var gBlacklist = new Array();
let gTrainSet = new Array();
let gTraining = false;
var gShortcutMap = new Map();
var gStrLength = 20;
let gSpinner = [
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧",
    "⠇",
    "⠏"
];

var gData = {
    shortcuts: new Array(),
    blacklist: new Array(),
    nn: {
        net: '',
        hiddenLayers: [20, 20],
        iterations:  100,
        batchSize: 5, 
        str_length: 20,
        svg: null,
        svg_struct: '20, 20'
    }
};

let scMsg = {
    type: "setShortcut",
    text: null,
    diff: null,
    shortcut: false,
    regex: null,
    targetWord: null,
    id: 0,
    source: null
};

const accptMsg = {
    type: "accept"
}
//-----

// init neural network
var gNNTrainWorker = new Worker('brain_worker.js');

gNNTrainWorker.onmessage = (e) => { workerMessage(e) };

function workerMessage(e) {
    if (e.data.type === 'net') {
        gNnet.fromJSON(JSON.parse(e.data.data));
        gData.nn.net = e.data.data;
        browser.storage.sync.set({'data': gData});
    } else if (e.data.type === 'log') {
        console.log(gSpinner[parseInt(e.data.stats.split(' ')[1].replace(',', '')) % gSpinner.length]);
        console.log(parseInt(e.data.stats.split(' ')[1].replace(',', '')) % gSpinner.length);
        browser.browserAction.setBadgeText({
            text: gSpinner[parseInt(e.data.stats.split(' ')[1].replace(',', '')) % gSpinner.length]
        });
    } else if (e.data.type === 'train') {
        if (e.data.status === 'start') {
            browser.browserAction.setIcon({
                path: {
                    48: '../icons/training.svg'
                }
            });
        } else if (e.data.status === 'end') {
            browser.browserAction.setIcon({
                path: {
                    48: '../icons/enabled.svg'
                }
            });
            browser.browserAction.setBadgeText({
                text: ''
            });
        }
    }
}
//-----

browser.browserAction.setBadgeBackgroundColor({
    color: 'black'
});

browser.browserAction.setBadgeTextColor({
    color: 'white'
});

browser.commands.onCommand.addListener(function(command) {
    if (command == 'accept-sc') {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            browser.tabs.sendMessage(tabs[0].id, accptMsg);
        });
    }
});

// Load state from storage
browser.storage.sync.get().then(function(result) {
    if (isEmptyObject(result)) {
        generateNnet();
    } else {
        update_shortcuts(result.data.shortcuts);
        update_blacklist(result.data.blacklist);
        gNnet.fromJSON(JSON.parse(result.data.nn.net));
        if (result.status != undefined) {
            gStatus = result.status;
        }
        gStrLength = result.data.nn.str_length;
    }

    // update NN thread
    gNNTrainWorker.postMessage({
        type: 'setNetwork',
        data: {
            net: JSON.stringify(gNnet.toJSON()),
            batchSize: gData.nn.batchSize,
            iterations: gData.nn.iterations,
            hiddenLayers: gData.nn.hiddenLayers
        }
    });
}, function(err) {
    console.log(err);
});

// message listener
browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'getBlacklist') {
        sendResponse({result: gBlacklist});
    } else if (request.type === 'getShortcut' && !(gStatus === 'disabled')) {
        scMsg.id = request.id + 1;
        updateText(request.text);
        trainNetwork(request.text);
    } else if (request.type === 'statusChange') {
        gStatus = request.status;

        // update action icon
        if (gStatus === 'disabled') {
            stopNet();
        } else {
           
        }
    }
});

function update_blacklist(data) {
    gBlacklist = new Array();
    for (let i = 0; i < data.length; i++) {
        gBlacklist.push(data[i].url);
    }
}

function update_shortcuts(data) {
    gShortcutMap = new Map();

    // convert 'sc, shortcut\n' -> {"sc": "shortcut"}
    for (let sc of data) {
        let reg = new RegExp(sc.shortcut + '$');
        gShortcutMap.set(reg, sc.target);
    }
}

// helper function to reset the shortcut message content
function resetMsg() {
        scMsg.text = '';
        scMsg.diff = 0;
        scMsg.shortcut = false;
        scMsg.regex = null;
        scMsg.targetWord = '';
        scMsg.source = null;
}

// update the text with the appropriate shortcut or prediction
function updateText(text) {
    resetMsg();
    for (let key_reg of gShortcutMap.keys()) {
        if (key_reg.test(text)) {
            scMsg.text = gShortcutMap.get(key_reg);
            scMsg.shortcut = true;
            scMsg.regex = key_reg;
            scMsg.targetWord = gShortcutMap.get(key_reg);
            scMsg.diff = scMsg.text.length;
            scMsg.source = 'shortcut';
        }
    }

    // if shortcut wasn't found use prediction
    if (!scMsg.shortcut) {
        scMsg.text = text;
        let sub = text.substring(text.length - gStrLength, text.length).replace('\n', ' ');
        if (!(sub === '') && !(sub === ' ')) {
            let pred = gNnet.run(sub);
            if (pred.length > 0 && pred.split(' ')[0].length < 20) {
                pred = pred.split(' ')[0];
                scMsg.text = pred;
                scMsg.shortcut = true;
                scMsg.diff = pred.length;
                scMsg.source = 'nnet';
            }
        }
    }
    
    if (scMsg.diff == 0) {
        return;
    }

    browser.tabs.query({ active: true, currentWindow: true }).then((_tabs) => {
        browser.tabs.sendMessage(_tabs[0].id, scMsg, function(res) {});
    });
}

// start a new neural network thread
function newNet() {
    gNNTrainWorker.terminate();
    gNNTrainWorker = new Worker('brain_worker.js');

    gNNTrainWorker.onmessage = (e) => { workerMessage(e) };

    gNNTrainWorker.postMessage({
        type: 'newNetwork',
        data: {
            net: gData.nn.net,
            batchSize: gData.nn.batchSize,
            iterations: gData.nn.iterations,
            hiddenLayers: gData.nn.hiddenLayers
        }
    });

    browser.browserAction.setBadgeText({
        text: ''
    });
}

// start a new neural network thread
function stopNet() {
    gNNTrainWorker.terminate();
    gNNTrainWorker = new Worker('brain_worker.js');

    gNNTrainWorker.onmessage = (e) => { workerMessage(e) };

    gNNTrainWorker.postMessage({
        type: 'setNetwork',
        data: {
            net: gData.nn.net,
            batchSize: gData.nn.batchSize,
            iterations: gData.nn.iterations,
            hiddenLayers: gData.nn.hiddenLayers
        }
    });

    browser.browserAction.setBadgeText({
        text: ''
    });

    browser.browserAction.setIcon({
        path: {
            48: '../icons/disabled.svg'
        }
    });
}

function isEmptyObject(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

// init the neural network
function generateNnet() {
    gNnet = new brain.recurrent.LSTM();
    let all_chars = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm,./;' + '[]`1234567890-=\\<>?:"{}~!@#$%^&*()_+"` \n\t\r' + "'";
    gNnet.train([all_chars], {
        iterations: 1
    });     // init the chars
    gData.nn.net = JSON.stringify(gNnet.toJSON());
    browser.storage.sync.set({'data': gData});
    browser.storage.sync.set({status: 1});
}

function trainNetwork(text) {
    if (gNnet == null) {
        generateNnet();
    }

    if (text.length >= gStrLength) {
        train_string = text.substring(text.length - gStrLength, text.length).replace('\n', ' ');
        gNNTrainWorker.postMessage({
            type: 'trainNetwork',
            data: train_string,
        });
    }
}
