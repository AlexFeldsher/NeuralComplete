importScripts('background/browser.js');

// default network
let hiddenLayers = [20, 20];
let network = new brain.recurrent.LSTM({
    hiddenLayers: hiddenLayers
});
let trainSet = new Array();
let batchSize = 5;
let iterations = 100;

onmessage = function(e) {
    if (e.data.type === 'newNetwork') {
        batchSize = e.data.data.batchSize;
        iterations = e.data.data.iterations;
        initNet(e.data.data.hiddenLayers);
        sendNetwork();
    } else if (e.data.type ==='setNetwork') {
        network.fromJSON(JSON.parse(e.data.data.net));        
        batchSize = e.data.data.batchSize;
        iterations = e.data.data.iterations;
        sendNetwork();
    } else if (e.data.type === 'setIterations') {
        iterations = e.data.iterations;
    } else if(e.data.type === 'setBatchSize') {
        batchSize = e.data.batchSize;
    } else if(e.data.type === 'setHiddenLayers') {
        trainSet = new Array();
        initNet(e.data.hiddenLayers);
        sendNetwork();
    } else if (e.data.type === 'trainNetwork') {
        trainSet.push(e.data.data);
        train();
    }
}

function train() {
    if (trainSet.length >= batchSize) {
        postMessage({type: 'train', status: 'start'});
        network.train(trainSet, {
            iterations: iterations,
            logPeriod: 10
        });
        trainSet = new Array();
        sendNetwork();
        postMessage({type: 'train', status: 'end'});
    }
}

function initNet(hl) {
    // initialize the possible chars for the input layer
    let all_chars = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm,./;' + '[]`1234567890-=\\<>?:"{}~!@#$%^&*()_+"` \n\t\r' + "'";
    network = new brain.recurrent.LSTM({
        hiddenLayers: hl
    });
    network.train([all_chars], {
        iterations: 1
    });
}

function sendNetwork() {
    const jsonNet = network.toJSON();
    postMessage({type: 'net', data: JSON.stringify(jsonNet)});
}