(function () {
    'use strict';

    // cache frequently used elements

    var doc = document;
    var playerElem = getById('player');
    var videoContainer = getById('video-container');
    var videoElem = getById('video');
    var loaderElem = getById('loader');

    var controls = {
        bar: getById('controls'),
        state: getById('state'),
        progress: {
            bar: getById('progress'),
            loaded: getById('progress-loaded'),
            played: getById('progress-played'),
            timeCurrent: getById('progress-time-current'),
            timeTotal: getById('progress-time-total'),
            tip: getById('progress-tip')
        },
        volume: {
            bar: getById('volume'),
            mute: getById('mute'),
            filled: getById('volume-filled'),
        },
        fullscreen: getById('fullscreen'),
        quality: {
            button: getById('quality'),
            value: getById('quality-value'),
            select: getById('quality-select')
        },
        watchOnVk: getById('watch-on-vk') 
    };


    var params = parseQueryString(doc.location.search);
    var state = {
        launched: false,
        seeking: false,
        fiveSecondsPlayed: false,
        startFrom: 0
    };
    var hideControlsTimer;
    var videoData;
    var authorData;


    // initialization

    if (!video.canPlayType || !video.canPlayType('video/mp4')) {
        getById('error-text').textContent = 'Your browser does not support html5 video :(';
        getById('error').classList.remove('-hidden');
        styleElem(controls.bar, {display: 'none'});
        styleElem(infoElem, {display: 'none'});
        return;
    }
    if (!fullscreenAvailable()) {
        styleElem(controls.fullscreen, {display: 'none'});
    }
    videoElem.volume = localStorage.getItem('vk-video-volume') || 0.7;
    resizeHandler();

    vkApi.setVersion(5.28);
    vkApi.setToken(params.token);
    loadVideo(params.owner_id + '_' + params.id);
    initHandlers();


    // initializers

    function loadVideo (mediaId, autoplay) {

        vkApi.callMethod('video.get', {
            videos: mediaId,
            extended: 1
        }, function (data) {
            if (data.error) {
                styleElem(getById('big-play-button'), {display: 'none'});
                getById('error-text').textContent = 'Something went wrong :(';
                getById('error').classList.remove('-hidden');
                console.error(data.error.error_msg);
                return;
            }

            videoData = data.response.items[0];
            if (data.response.profiles.length) {
                var user = data.response.profiles[0];
                authorData = {
                    name: user.first_name + ' ' + user.last_name,
                    link: '//vk.com/id' + user.id
                };
            } else if (data.response.groups.length) {
                var group = data.response.groups[0];
                authorData = {
                    name: group.name,
                    link: '//vk.com/club' + group.id,
                    isGroup: true
                };
            }

            initInfo();
            initControls();
            initVideo();

            if (autoplay) {
                videoElem.load();
                videoElem.play();
                showLoader();
                listenOnce(videoElem, 'loadeddata', hideLoader);
            }
        });

        state.fiveSecondsPlayed = false;
        state.startFrom = 0;
        updateCurTimePosition(0);
        styleElem(controls.progress.loaded, {
            left: 0,
            right: 'auto'
        });
    }

    function initInfo () {
        var titleElem = getById('info-title');
        var authorElem = getById('info-author');
        titleElem.textContent = videoData.title;
        titleElem.href = '//vk.com/video' + videoData.owner_id + '_' + videoData.id;
        authorElem.textContent = authorData.name;
        authorElem.title = authorData.name;
        authorElem.href = authorData.link;
    }

    function initControls () {
        controls.progress.timeCurrent.textContent = formatTime(0);
        controls.progress.timeTotal.textContent = formatTime(videoData.duration);

        emptyElem(controls.quality.select);

        ['720', '480', '360', '240'].forEach(function (quality) {
            if (videoData.files['mp4_' + quality]) {
                var item = document.createElement('li');
                item.className = 'quality__item';
                item.setAttribute('data-value', quality);
                item.textContent = quality;
                controls.quality.select.appendChild(item);
            }
        });

    }

    function initVideo () {
        videoElem.poster = videoData.photo_640 || videoData.photo_320 || videoData.photo_130;
        ['720', '480', '360', '240'].some(function (quality) {
            if (videoData.files['mp4_' + quality]) {
                setQuality(quality, true);
                return true;
            }
        });

    }

    function initHandlers () {

        // user-generated events

        doc.addEventListener('keydown', keydownHandler);
        videoContainer.addEventListener('click', togglePlayState);
        controls.state.addEventListener('click', togglePlayState);
        controls.progress.bar.addEventListener('mouseenter', progressMouseEnterHandler);
        controls.progress.bar.addEventListener('mousedown', progressMouseDownHandler);
        controls.volume.mute.addEventListener('click', toggleMute);
        controls.volume.bar.addEventListener('mousedown', volumeMouseHandler);
        controls.fullscreen.addEventListener('click', toggleFullscreen);

        controls.quality.button.addEventListener('mouseover', function (evt) {
            if (evt.target !== evt.currentTarget) return;
            controls.quality.select.classList.remove('-hidden');
        });

        controls.quality.button.addEventListener('mouseleave', function () {
            controls.quality.select.classList.add('-hidden');
        });

        controls.quality.select.addEventListener('click', function (evt) {
            var newQuality = evt.target.getAttribute('data-value');
            setQuality(newQuality);
            controls.quality.select.classList.add('-hidden');
        });

        videoContainer.addEventListener('mousemove', function () {
            clearTimeout(hideControlsTimer);
            showControls();
            if (!videoElem.paused && !state.seeking) {
                hideControlsTimer = setTimeout(hideControls, 3000);
            }
        });

        controls.bar.addEventListener('mouseenter', function () {
            clearTimeout(hideControlsTimer);
        });

        playerElem.addEventListener('mouseleave', function () {
            if (!videoElem.paused && !state.seeking) hideControls();
        });

        controls.watchOnVk.addEventListener('click', function () {
            var url = 'https://vk.com/video' + videoData.owner_id + '_' + videoData.id;
            window.open(url, '_blank');
        });

        window.addEventListener('resize', resizeHandler);

        doc.addEventListener('fullscreenchange', fullscreenChangeHandler);
        doc.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
        doc.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
        doc.addEventListener('MSFullscreenChange', fullscreenChangeHandler);

        // media events

        videoElem.addEventListener('progress', bufferingProgressHandler);
        videoElem.addEventListener('timeupdate', timeupdateHandler);
        videoElem.addEventListener('volumechange', volumeChangeHandler);
        videoElem.addEventListener('error', videoErrorHandler);

        videoElem.addEventListener('play', function () {
            if (!state.launched) {
                styleElem(getById('big-play-button'), {display: 'none'});
                state.launched = true;
                if (!videoElem.readyState) {
                    showLoader();
                    listenOnce(videoElem, 'loadeddata', hideLoader);
                }
            }
            videoElem.removeAttribute('poster');
            playerElem.classList.add('player_playing');
            hideControlsTimer = setTimeout(hideControls, 3000);
        });

        videoElem.addEventListener('pause', function () {
            playerElem.classList.remove('player_playing');
            showControls();
            clearTimeout(hideControlsTimer);
        });

        videoElem.addEventListener('seeking', showLoader);

        videoElem.addEventListener('seeked', hideLoader);

        videoElem.addEventListener('ended', showSuggestions);

    }


    // player methods

    function togglePlayState (evt) {
        evt && evt.preventDefault();
        videoElem[videoElem.paused ? 'play' : 'pause']();
    }

    function seekTo (progress) {
        progress = normalizeScale(progress);
        if (!videoElem.readyState) {
            styleElem(getById('big-play-button'), {display: 'none'});
            videoElem.src = videoElem.src.split('#')[0] + '#t=' + videoData.duration * progress; // neccessary for working in Safari
            videoElem.load();
            videoElem.play();
            listenOnce(videoElem, 'loadedmetadata', function () {
                // necessary for working in IE
                //   because it doesn't support media fragment uri
                videoElem.currentTime = progress * videoElem.duration;
                videoElem.play();
                updateCurTimePosition(progress);
            });
            state.startFrom = videoData.duration * progress;
        } else {
            videoElem.currentTime = videoElem.duration * progress;
        }
        updateCurTimePosition(progress);
    }

    function toggleMute () {
        videoElem.muted = !videoElem.muted;
    }

    function setVolume (vol) {
        videoElem.volume = normalizeScale(vol);
    }

    function toggleFullscreen () {
        if (isFullscreen()) {
            exitFullscreen();
        } else {
            enterFullscreen(player);
        }
    }

    function setQuality (quality, initial) {
        var curTime = videoElem.currentTime;
        videoElem.src = videoData.files['mp4_' + quality];
        if (!initial) {
            var progress = curTime / videoData.duration;
            seekTo(progress);
        }

        controls.quality.value.textContent = quality;
        var selectItems = controls.quality.select.children;
        for (var i=0, len=selectItems.length; i < len; i++) {
            var item = selectItems[i];
            if (item.getAttribute('data-value') == quality) {
                styleElem(item, {display: 'none'});
            } else {
                styleElem(item, {display: ''});
            }
        }
    }

    function showControls () {
        controls.bar.classList.remove('-hidden');
        styleElem(player, {cursor: ''});
    }

    function hideControls () {
        controls.bar.classList.add('-hidden');
        styleElem(player, {cursor: 'none'});
    }

    function showLoader () {
        loaderElem.classList.remove('-hidden');
    }

    function hideLoader () {
        loaderElem.classList.add('-hidden');
    }

    function updateCurTimePosition (progress) {
        if (progress === 0) {
            controls.progress.timeCurrent.textContent = formatTime(progress);
        } else {
            progress = normalizeScale(progress);
            var duration = videoElem.duration || videoData.duration;
            controls.progress.timeCurrent.textContent = formatTime(duration * progress);
        }

        var progressbarWidth = controls.progress.bar.clientWidth;
        var curTimeWidth = controls.progress.timeCurrent.clientWidth;
        var curTimeHalfWidth = curTimeWidth / 2;
        var totalTimeWidth = controls.progress.timeTotal.clientWidth;
        var left = 100 * progress;
        var marginLeft = -curTimeHalfWidth;

        if (progressbarWidth*progress < curTimeHalfWidth) {
            // progress is in the start, margin is not needed
            left = 0;
            marginLeft = 0;
        } else if (progress + (totalTimeWidth+curTimeHalfWidth)/progressbarWidth > 1) {
            // progress is in the end, need some margin
            //      to prevent overlaying with total time
            left = 100;
            marginLeft = -(curTimeWidth + totalTimeWidth);
        }

        styleElem(controls.progress.timeCurrent, {
            left: left + '%',
            marginLeft: marginLeft + 'px'
        });

        styleElem(controls.progress.played, {
            width: 100 * progress + '%'
        });
    }

    function showSuggestions () {

        var container = getById('suggestions');
        var list = getById('suggestions-list');

        resizeSuggestions();

        container.classList.remove('-hidden');

        videoElem.addEventListener('play', hideSuggestions);
        window.addEventListener('resize', resizeSuggestions);
        list.addEventListener('click', listClickHandler);

        function hideSuggestions () {
            container.classList.add('-hidden');
            videoElem.removeEventListener('play', hideSuggestions);
            window.removeEventListener('resize', resizeSuggestions);
            list.removeEventListener('click', listClickHandler);
        }

        function listClickHandler (evt) {
            evt.preventDefault();
            var item = evt.target;
            while (item.nodeName !== 'A') {
                if (item === list) return;
                item = item.parentNode;
            }
            loadVideo(item.getAttribute('data-video'), true);
        }

        function resizeSuggestions () {
            var width = container.clientWidth;
            var height = container.clientHeight - 95; // 95 padding from top and bottom panels
            var columns;
            var rows;
            var columnWidth;
            var rowHeight;
            if (width > 1000 && height > 500) {
                columns = 4;
                rows = 3;
            } else {
                columns = Math.floor(width / 200) || 1;
                rows = Math.floor(height / 120) || 1;

                while (rows * columns > 12) {
                    // too many cells. Reduce rows or columns?
                    if (rows <= columns && width*(3/4) < height) {
                        columns--;
                    } else {
                        rows--;
                    }
                }
            }
            styleElem(list, {
                width: columns*320 < width ? columns*320 + 'px' : 'auto',
                height: rows*240 < height ? rows*240 + 'px' : 'auto'
            });
            list.className = 'suggestions__list -columns-' + columns + ' -rows-' + rows;
        }
    }


    // user events handlers

    function keydownHandler (evt) {
        switch (evt.keyCode) {
            case 32:
                togglePlayState();
                evt.preventDefault();
                break;
            case 38:
            case 40:
                var direction = evt.keyCode === 38 ? 1 : -1;
                setVolume(videoElem.volume + 0.05 * direction);
                evt.preventDefault();
                break;
            case 37:
            case 39:
                var direction = evt.keyCode === 39 ? 1 : -1;
                var duration = videoElem.duration || videoData.duration;
                seekTo((videoElem.currentTime + 3*direction) / duration);
                evt.preventDefault();
                break;
        }
    }

    function progressMouseEnterHandler (evt) {
        if (state.seeking || !videoData) return;
        var progressbar = controls.progress.bar;
        progressbar.addEventListener('mousemove', mousemoveHandler);
        progressbar.addEventListener('mouseleave', mouseleaveHandler); 
        controls.progress.tip.classList.remove('-hidden');

        function mousemoveHandler (evt) {
            if (!videoData) return;
            var progressbarRect = progressbar.getBoundingClientRect();
            var progress = (evt.pageX - progressbarRect.left) / progressbarRect.width;
            progress = normalizeScale(progress);
            controls.progress.tip.textContent = formatTime(videoData.duration * progress);
            styleElem(controls.progress.tip, {
                left: 100 * progress + '%'
            });
        }

        function mouseleaveHandler () {
            controls.progress.tip.classList.add('-hidden');
            progressbar.removeEventListener('mousemove', mousemoveHandler);
            progressbar.removeEventListener('mouseleave', mouseleaveHandler);
        }
    }

    function progressMouseDownHandler (evt) {
        state.seeking = true;
        var progressbar = controls.progress.bar;
        var progressbarRect = progressbar.getBoundingClientRect();
        var progress = (evt.pageX - progressbarRect.left) / progressbarRect.width;
        seekTo(progress);

        controls.progress.tip.classList.add('-hidden');

        window.addEventListener('mousemove', mousemoveHandler);
        window.addEventListener('mouseup', mouseupHandler);

        function mousemoveHandler (evt) {
            var progressbarRect = progressbar.getBoundingClientRect();
            var progress = (evt.pageX - progressbarRect.left) / progressbarRect.width;
            seekTo(progress);
        }

        function mouseupHandler (evt) {
            state.seeking = false;
            var progressbarRect = progressbar.getBoundingClientRect();
            var progress = (evt.pageX - progressbarRect.left) / progressbarRect.width;
            seekTo(progress);
            window.removeEventListener('mousemove', mousemoveHandler);
            window.removeEventListener('mouseup', mouseupHandler);
        }
    }

    function volumeMouseHandler (evt) {
        var volumebar = controls.volume.bar;
        var volumebarRect = volumebar.getBoundingClientRect();
        videoElem.muted = false;
        setVolume((evt.pageX - volumebarRect.left) / volumebarRect.width);

        window.addEventListener('mousemove', mousemoveHandler);
        window.addEventListener('mouseup', mouseupHandler);

        function mousemoveHandler (evt) {
            var volumebarRect = volumebar.getBoundingClientRect();
            setVolume((evt.pageX - volumebarRect.left) / volumebarRect.width);
        }

        function mouseupHandler (evt) {
            var volumebarRect = volumebar.getBoundingClientRect();
            setVolume((evt.pageX - volumebarRect.left) / volumebarRect.width);
            window.removeEventListener('mousemove', mousemoveHandler);
            window.removeEventListener('mouseup', mouseupHandler);
        }
    }

    function resizeHandler () {
        if (state.launched) {
            var duration = videoElem.duration || videoData.duration;
            updateCurTimePosition(state.startFrom / duration);
        }
        if (playerElem.clientWidth < 400) {
            playerElem.classList.add('player_min');
        } else {
            playerElem.classList.remove('player_min');
        }
    }

    // video events handlers

    function bufferingProgressHandler () {
        var curTime = videoElem.currentTime;
        var buffered = videoElem.buffered;
        var start;
        var end;
        for (var i=0, len=buffered.length; i < len; i++) {
            start = buffered.start(i);
            end = buffered.end(i);
            if (start <= curTime && curTime <= end) {
                break;
            } else {
                start = end = null;
            }
        }
        styleElem(controls.progress.loaded, {
            left: 100 * (start / videoElem.duration) + '%',
            right: 100 - 100 * (end / videoElem.duration) + '%'
        });
    }

    function timeupdateHandler () {
        var duration = videoElem.duration || videoData.duration;

        if (!videoElem.readyState) {
            updateCurTimePosition(state.startFrom / duration);
        } else if (!state.seeking) {
            updateCurTimePosition(videoElem.currentTime / duration);
        }

        if (!state.fiveSecondsPlayed) {
            var played = videoElem.played;
            var playedSum = 0;
            for (var i=0, len=played.length; i < len; i++) {
                playedSum += played.end(i) - played.start(i);
            }
            if (playedSum > 5) {
                state.fiveSecondsPlayed = true;
                console.info('Five seconds played');
            }
        }
    }

    function volumeChangeHandler () {
        var volume = videoElem.muted ? 0 : videoElem.volume;
        var icon = controls.volume.mute.children[0];
        if (!volume) {
            icon.className = 'icon-controls icon-controls-volume-none';
        } else if (volume < 0.33) {
            icon.className = 'icon-controls icon-controls-volume-low';
        } else if (volume < 0.66) {
            icon.className = 'icon-controls icon-controls-volume-mid';
        } else {
            icon.className = 'icon-controls icon-controls-volume-high';
        }

        styleElem(controls.volume.filled, {
            width: 100 * volume + '%'
        });
        localStorage.setItem('vk-video-volume', volume);
    }

    function videoErrorHandler () {
        getById('error-text').textContent = 'Something went wrong :(';
        getById('error').classList.remove('-hidden');
        loaderElem.classList.add('-hidden');
        videoElem.pause();

        videoElem.addEventListener('play', playHandler);

        function playHandler () {
            getById('error').classList.add('-hidden');
            videoElem.removeEventListener('play', playHandler);
        }
    }

    function fullscreenChangeHandler () {
        playerElem.classList.toggle('player_fullscreen');
    }


    // utils

    function formatTime (time) {
        var hours = Math.floor(time / 3600);
        var minutes = Math.floor((time - hours*3600) / 60);
        var seconds = Math.floor(time % 60);
        if (hours && minutes < 10) {
            minutes = '0' + minutes;
        }
        if (seconds < 10) {
            seconds = '0' + seconds;
        }
        return  (hours ? hours + ':' : '') + minutes + ':' + seconds;
    }

    function getById (id) {
        return doc.getElementById(id);
    }

    function styleElem (elem, props) {
        Object.keys(props)
            .forEach(function (prop) {
                elem.style[prop] = props[prop];
            });
    }

    function emptyElem (elem) {
        for (var lastChild; lastChild = elem.lastChild; ) {
            elem.removeChild(lastChild);
        }
    }

    function listenOnce (elem, eventType, handler) {
        elem.addEventListener(eventType, function listener (evt) {
            handler(evt);
            elem.removeEventListener(eventType, listener);
        });
    }

    function normalizeScale (value) {
        if (value < 0) {
            return 0;
        } else if (value > 1) {
            return 1;
        } else {
            return value;
        }
    }

    function parseQueryString (queryString) {
        var obj = {};
        queryString
            .replace(/^\?/, '')
            .split('&')
            .forEach(function (item) {
                var splitted = item.split('=');
                obj[decodeURIComponent(splitted[0])] = decodeURIComponent(splitted[1]);
            });
        return obj;
    }

    function fullscreenAvailable () {
        return doc.fullscreenEnabled || doc.webkitFullscreenEnabled || doc.mozFullScreenEnabled;
    }

    function enterFullscreen (elem) {
        (elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen).call(elem);
    }

    function exitFullscreen () {
        (doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen).call(doc);
    }

    function isFullscreen () {
        return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement);
    }

    function throttle (fn, delay) {
        var timeout;
        return function () {
            var args = arguments;
            var context = this;
            if (!timeout) {
                timeout = setTimeout(function() {
                    timeout = 0;
                    return fn.apply(context, args);
                }, delay);
            }
        };
    }

})();
