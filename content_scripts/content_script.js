document.addEventListener('DOMContentLoaded', run());

function run() {

    const _textArea = new Array();
    const _last_keypress = { key: '', target: null };
    let _lastInputElement = null;
    let _lastMessage = null;
    let _lastMsgId = 0;
    let _lastInMsgType = 'shortcut';

    // request the blacklist
    browser.runtime.sendMessage({
        type: 'getBlacklist'
    }).then(function(msg) {
        // if not blacklisted add listeners to input elements
        if (!doc_is_blacklisted(msg.result)) {
            add_listeners();
        }
    });

    // message listener
    browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'setShortcut') {
            _lastInMsgType = request.source;
            insertText(request);
        } else if (request.type === 'accept') {
            acceptChange();
        }
    });

    function sendInput(e) {
        // skip backspaces
        if (_last_keypress.key == 'Backspace') {
            return;
        }

        const msg = {
            type: "getShortcut",
            text: e.target.value,
            id: _lastMsgId
        }

        _lastMsgId++;

        browser.runtime.sendMessage(msg);
    }

    function sendDocText(e) {
        const msg = {
            type: "textContent",
            text: document.documentElement.textContent
        }

        browser.runtime.sendMessage(msg);
    }

    // called by keyboard command defined in the manifest
    function acceptChange() {
        if (_lastMessage && _lastInMsgType === 'shortcut') {
            if (_lastMessage.shortcut && _lastInputElement.id == _last_keypress.target.id) {
                const lastPos = _lastInputElement.selectionStart;
                const origText = _lastInputElement.value.substring(0, lastPos);
                _lastInputElement.value = origText.replace(_lastMessage.regex, _lastMessage.targetWord + ' ');
            }
        }
        if (_lastInMsgType === 'nnet') {
            _lastInputElement.selectionStart = _lastInputElement.value.length;
        }
    }

    // check if the current document is blacklisted
    function doc_is_blacklisted(blacklist) {
        for (let i = 0; i < blacklist.length; i++) {
            if (document.URL.includes(blacklist[i])) {
                return true;
            }
        }
        return false;
    }

    // insert the new text to the appropriate input element
    function insertText(message) {
        if (message.id != _lastMsgId) {
            return;
        }

        let element = document.activeElement;

        element.value = message.text;
        if (message.diff > 0) {
            element.selectionStart = message.text.length - message.diff;
            element.selectionEnd = message.text.length;
        }

        _lastMessage = message;
        _lastInputElement = element;
    }

    // TODO: handle backspace and tab in content script

    // capture textareas when are in focuse
    function add_listeners() {
        document.addEventListener('click', function(e) {
            if (e.target && !_textArea.includes(e.target)) {
                if (e.target.nodeName === 'TEXTAREA' || e.target.nodeName === 'INPUT') {

                    _textArea.push(e.target);

                    e.target.addEventListener("keydown", (e) => {
                        _last_keypress.key = e.key;
                        _last_keypress.target = e.target;
                        if (e.key == 'ArrowRight') {
                            acceptChange();
                        }
                    });

                    e.target.addEventListener("input", sendInput);
                }
            }    
        });
    }

}

