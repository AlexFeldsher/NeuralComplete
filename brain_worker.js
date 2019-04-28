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
        console.log('new network')
        //network.fromJSON(JSON.parse(e.data.data.net));        
        batchSize = e.data.data.batchSize;
        iterations = e.data.data.iterations;
        initNet(e.data.data.hiddenLayers);
        postMessage(JSON.stringify(network.toJSON()));
    } else if (e.data.type ==='setNetwork') {
        console.log('setting network')
        network.fromJSON(JSON.parse(e.data.data.net));        
        batchSize = e.data.data.batchSize;
        iterations = e.data.data.iterations;
        //initNet(e.data.data.hiddenLayers);
        postMessage(JSON.stringify(network.toJSON()));
    } else if (e.data.type === 'setIterations') {
        console.log('updating iterations');
        iterations = e.data.iterations;
    } else if(e.data.type === 'setBatchSize') {
        console.log('updating batchSize');
        batchSize = e.data.batchSize;
    } else if(e.data.type === 'setHiddenLayers') {
        console.log('updating hidden layers');
        trainSet = new Array();
        initNet(e.data.hiddenLayers);
        postMessage(JSON.stringify(network.toJSON()));
    } else if (e.data.type === 'trainNetwork') {
        console.log(`input: ${e.data.data}`);
        trainSet.push(e.data.data);
        train();
    }
}

function train() {
    if (trainSet.length >= batchSize) {
        network.train(trainSet, {
            iterations: iterations,
            logPeriod: 10,
            log: (stats) => console.log(stats)
        });
        trainSet = new Array();

        const jsonNet = network.toJSON();
        postMessage(JSON.stringify(jsonNet));
    }
}

function initNet(hl) {
    // initialize the possible chars for the input layer
    let all_chars = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm,./;' + '[]`1234567890-=\\<>?:"{}~!@#$%^&*()_+"` \n\t\r' + "'";
    //all_chars += all_chars;
    network = new brain.recurrent.LSTM({
        hiddenLayers: hl
    });
    network.train([all_chars], {
        iterations: 1
    });
}