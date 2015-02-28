'use strict';

window.vkApi = (function () {

    var callbacks = [];
    var docHead = document.head;
    var token = null;
    var apiVer = 3;


    function callMethod (methodName, params, callback) {

        var reqUrl = 'https://api.vk.com/method/' + methodName + '?' + makeQueryString(params);

        jsonpRequest(reqUrl, callback);

    }

    function jsonpRequest (url, callback) {

        var script = document.createElement('script');

        var callbackIndex = callbacks.push(onResponse) - 1;

        script.src = url + '&callback=vkApi._callbacks[' + callbackIndex + ']';

        docHead.appendChild(script);

        function onResponse (data) {
            docHead.removeChild(script);
            script = null;
            callbacks[callbackIndex] = null;
            callback(data);
        }

    }


    function setToken (newToken) {
        token = newToken;
    }


    function setVersion (newVersion) {
        apiVer = newVersion;
    }


    function makeQueryString (obj) {

        return Object.keys(obj)
            .map(function (key) {
                return key + '=' + encodeURIComponent(obj[key]);
            })
            .join('&')
            .concat('&v=' + apiVer)
            .concat(token ? '&access_token=' + token : '');

    }


    return {
        _callbacks: callbacks,
        callMethod: callMethod,
        setToken: setToken,
        setVersion: setVersion
    };

})();
