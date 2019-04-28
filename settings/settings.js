// window with background script scope
// used to update the background script with changes
const gBackgroundPage = browser.extension.getBackgroundPage();

// when page loaded, load data from storage
document.addEventListener("DOMContentLoaded", function() {
    loadData();
});

// save data to storage and update the background script
document.getElementById("save_button").addEventListener("click", function() {

    const hiddenLayers = getHiddenLayers();
    const iterations = parseInt(document.getElementById("nn-iterations").value) || 100;
    const batchSize = parseInt(document.getElementById("nn-batch-size").value) || 5;
    const str_length = parseInt(document.getElementById("nn-string-length").value) || 20;

    if (!equalArrays(gBackgroundPage.gData.nn.hiddenLayers, hiddenLayers)) {
        gBackgroundPage.gData.nn.hiddenLayers = hiddenLayers;
        gBackgroundPage.newNet();
        generateNNSvg();    // update svg
    } 
    if (gBackgroundPage.gData.nn.iterations != iterations) {
        gBackgroundPage.gData.nn.iterations = iterations;
        gBackgroundPage.gNNTrainWorker.postMessage({
            type: 'setIterations',
            iterations: iterations 
        });
    }
    if (gBackgroundPage.gData.nn.batchSize != batchSize) {
        gBackgroundPage.gData.nn.batchSize = batchSize;
        gBackgroundPage.gNNTrainWorker.postMessage({
            type: 'setBatchSize',
            batchSize: batchSize 
        });
    }
    if (gBackgroundPage.gData.nn.str_length != str_length) {
        gBackgroundPage.gData.nn.str_length = str_length;
        gBackgroundPage.gStrLength = str_length;
    }

    browser.storage.sync.set({'data': gBackgroundPage.gData});
    gBackgroundPage.update_blacklist(gBackgroundPage.gData.blacklist);
    gBackgroundPage.update_shortcuts(gBackgroundPage.gData.shortcuts);

    UIkit.notification({
        message: 'Changes saved.',
        status: 'primary',
        pos: 'top-center',
        timeout: 2000
    });
});



// returns a list of integers
function getHiddenLayers() {
    const hiddenStringArray = document.getElementById("nn-hidden-layers").value.split(",");
    const hiddenLayers = new Array();
    for (let i = 0; i < hiddenStringArray.length; i++) {
        hiddenLayers.push(parseInt(hiddenStringArray[i].trim()));
    }

    if (hiddenLayers.length == 0) {
        return [20, 20];
    }
    return hiddenLayers;
}

// cancel changes
document.getElementById('undo_button').addEventListener('click', () => {
    newTbody('sc_body');
    newTbody('bl_body');
    loadData();
});


function loadData() {
    browser.storage.sync.get().then(function(result) {

        if (isEmptyObject(result)) {
            result.data = gBackgroundPage.gData;
        } else {
            gBackgroundPage.gData = result.data
        }

        // populate shortcut table
        if (result.data.shortcuts.length > 0) {
            for (let i = 0; i < result.data.shortcuts.length; i++) {
                let sc = result.data.shortcuts[i];
                add_shortcut_to_table(i, sc.shortcut, sc.target);
            }

        }

        // populate blacklist table
        if (result.data.blacklist.length > 0) {
            for (let i = 0; i < result.data.blacklist.length; i++) {
                let bl = result.data.blacklist[i];
                add_blacklist_to_table(i, bl.url);
            }
        }

        // init neural network svg
        if (result.data.nn.svg == null || !(result.data.nn.svg_struct === result.data.nn.hiddenLayers)) {
            generateNNSvg();
        } else {
            const parser = new DOMParser();
            parsed = parser.parseFromString(result.data.nn.svg, 'image/svg+xml');
            document.getElementById('nn_svg_result').appendChild(parsed.childNodes[0]);
        }


        document.getElementById("nn-hidden-layers").value = gBackgroundPage.gData.nn.hiddenLayers;
        document.getElementById("nn-iterations").value = gBackgroundPage.gData.nn.iterations;
        document.getElementById("nn-batch-size").value = gBackgroundPage.gData.nn.batchSize;
        document.getElementById("nn-string-length").value = gBackgroundPage.gData.nn.str_length;
    }, (err) => {
        console.log(err);
    });

}

// add shortcut line to html table
function add_shortcut_to_table(i, sc, tg) {
    document.getElementById("sc_body").insertAdjacentHTML('beforeend', `
        <tr id="sc_line">
            <td>${i}</td>
            <td>${sc}</td>
            <td>${tg}</td>
            <td><input class="uk-checkbox" type="checkbox" name="sc_cb"></td>
        </tr>
    `);
}

// add shortcut line to html table
function add_blacklist_to_table(i, bl) {
    document.getElementById("bl_body").insertAdjacentHTML('beforeend', `
        <tr id="bl_line">
            <td>${i}</td>
            <td>${bl}</td>
            <td><input class="uk-checkbox" type="checkbox" name="bl_cb"></td>
        </tr>
    `);
}

// listen to all click events
document.addEventListener('click', function(e) {
    if(e.target) {
        // if table line clicked -> change checkbox state
        if(e.target.parentElement.id == "sc_line" || e.target.parentElement.id == "bl_line") {
            let checkbox = e.target.parentElement.getElementsByClassName("uk-checkbox")[0]
            if (checkbox.checked) {
                checkbox.checked = false;
            } else {
                checkbox.checked = true;
            }
        }
    }
});

// remove selected shortcut table elements
document.getElementById("sc_remove_button").addEventListener('click', function() {
    let remove_idx = new Array();
    document.getElementsByName("sc_cb").forEach(function(element) {
            if (element.checked) {
                element.disabled = true;
                remove_idx.push(Number(element.parentElement.parentElement.children[0].textContent));
            }
    });
    // sort descending
    remove_idx.sort(function(a, b) {
        return b - a;
    });
    remove_idx.forEach(function(e) {
        gBackgroundPage.gData.shortcuts.splice(e, 1);
    });

    // refresh the table
    newTbody('sc_body');

    for (let i = 0; i < gBackgroundPage.gData.shortcuts.length; i++) {
        add_shortcut_to_table(i, gBackgroundPage.gData.shortcuts[i].shortcut, gBackgroundPage.gData.shortcuts[i].target);
    }

});


// remove selected blacklist table elements
document.getElementById("bl_remove_button").addEventListener('click', function() {
    let remove_idx = new Array();
    document.getElementsByName("bl_cb").forEach(function(element) {
            if (element.checked) {
                element.disabled = true;
                remove_idx.push(Number(element.parentElement.parentElement.children[0].textContent));
            }
    });
    // sort descending
    remove_idx.sort(function(a, b) {
        return b - a;
    });
    remove_idx.forEach(function(e) {
        gBackgroundPage.gData.blacklist.splice(e, 1);
    });

    // refresh the table
    newTbody('bl_body');

    for (let i = 0; i < gBackgroundPage.gData.blacklist.length; i++) {
        add_blacklist_to_table(i, gBackgroundPage.gData.blacklist[i].url);
    }

});


// add element to shortcut table
document.getElementById("sc_add_button").addEventListener('click', function() {
    let sc = document.getElementById("sc_input")
    let tg = document.getElementById("tg_input")

    if (sc.value.trim() === '' || tg.value.trim() === '') {
        document.getElementById("sc_table").insertAdjacentHTML('afterend', `
            <div class="uk-alert-danger" uk-alert>
                <a class="uk-alert-close" uk-close></a>
                <p>Invalid input</p>
            </div>
        `);
        return;
    }

    for (let i = 0; i < gBackgroundPage.gData.shortcuts.length; i++) {
        let _sc = gBackgroundPage.gData.shortcuts[i].shortcut;
        if (_sc === sc.value.trim()) {
            document.getElementById("sc_table").insertAdjacentHTML('afterend', `
                <div class="uk-alert-danger" uk-alert>
                    <a class="uk-alert-close" uk-close></a>
                    <p>${_sc} already exists</p>
                </div>
            `);
            return;
        }
    }

    gBackgroundPage.gData.shortcuts.push({
        shortcut: sc.value.trim(),
        target: tg.value.trim()
    });

    add_shortcut_to_table(gBackgroundPage.gData.shortcuts.length - 1, sc.value.trim(), tg.value.trim());

    // clear input boxes
    sc.value = '';
    tg.value = '';
});

// add element to blacklist table
document.getElementById("bl_add_button").addEventListener('click', function() {
    let bl = document.getElementById("bl_input")

    if (!validURL(bl.value.trim())) {
        document.getElementById("bl_table").insertAdjacentHTML('afterend', `
            <div class="uk-alert-danger" uk-alert>
                <a class="uk-alert-close" uk-close></a>
                <p>Invalid URL</p>
            </div>
        `);
        return;
    }

    for (let i = 0; i < gBackgroundPage.gData.blacklist.length; i++) {
        let _bl = gBackgroundPage.gData.blacklist[i].url;
        if (_bl === bl.value.trim().toLowerCase()) {
            document.getElementById("bl_table").insertAdjacentHTML('afterend', `
                <div class="uk-alert-danger" uk-alert>
                    <a class="uk-alert-close" uk-close></a>
                    <p>${_bl} already exists</p>
                </div>
            `);
            return;
        }
    }

    gBackgroundPage.gData.blacklist.push({
        url: bl.value.trim().toLowerCase()
    });

    add_blacklist_to_table(gBackgroundPage.gData.blacklist.length - 1, bl.value.trim().toLowerCase());

    // clear input box
    bl.value = '';
});


function validURL(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return !!pattern.test(str);
}

// create new tbody element and replace the one with the given id
function newTbody(id) {
    let newTbody = document.createElement('tbody');
    newTbody.id = id;
    let oldTbody = document.getElementById(id);
    oldTbody.parentNode.replaceChild(newTbody, oldTbody);
}

function isEmptyObject(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

function constructOptions() {
    const options={}
    options.height = 500;
    options.width = 700;
    options.radius = 6;
    options.line = {}
    options.inputs = {}
    options.hidden = {}
    options.outputs = {}
    options.line.width = 0.5;
    options.line.color = 'black';
    options.inputs.color = 'rgba(0, 128, 0, 0.5)';
    options.hidden.color = 'rgba(255, 127, 80, 0.5)';
    options.outputs.color = 'rgba(100, 149, 237, 0.5)';
    options.fontSize = '14px';
    options.inputs.label = ['']
    return options
}

function generateNNSvg() {
    const options = constructOptions();
    gBackgroundPage.gData.nn.svg = gBackgroundPage.brain.utilities.toSVG(gBackgroundPage.gNnet, options);
    gBackgroundPage.gData.nn.svg_struct = gBackgroundPage.gData.nn.hiddenLayers.toString();

    const parser = new DOMParser();
    parsed = parser.parseFromString(gBackgroundPage.gData.nn.svg, 'image/svg+xml');
    let child = document.getElementById('nn_svg_result').firstChild;
    if (child) {
        document.getElementById('nn_svg_result').removeChild(child);
    }
    document.getElementById('nn_svg_result').appendChild(parsed.childNodes[0]);
}

// check if arrays are equal
function equalArrays(ar1, ar2) {
    if (ar1.length != ar2.length) {
        return false;
    }

    for (let i = 0; i < ar1.length; i++) {
        if (ar1[i] != ar2[i]) {
            return false;
        }
    }

    return true;
}