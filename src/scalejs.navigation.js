define([
    'scalejs!core',
    'knockout',
    'crossroads',
    'hasher'
], function (
    core,
    ko,
    crossroads,
    hasher
) {

   'use strict';

    var navLinks = ko.observableArray(),
        activeLink = ko.observable(),
        navLinkMap = {},
        navigation = navigation,
        active = true;

    function parseQuery(qstr) {
        var query = {};
        var a = qstr.substr(1).split('&');
        for (var i = 0; i < a.length; i = i+1 ) {
            var b = a[i].split('=');
            query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '');
        }
        Object.keys(query).forEach(function(key) {
            // TODO: implement better typecasting
            if (query[key] === 'true') {
                query[key] = true;
            }
            if (query[key] === 'false') {
                query[key] = false;
            }
        })
        return query;
    }

    function addNav(navText, routeOrCallback, routeCallback, canNav) {
        var route, link, callback, defaultRoute, decodeRoute;

        if (typeof routeOrCallback === 'function' ) {
            callback = routeOrCallback;
        } else {
            route = routeOrCallback;
            // determine the 'default' route for the link
            // incase we want to have sub-navigations...
            defaultRoute = route.split('/')[0];

            callback = function () {
                crossroads.parse(defaultRoute);
            }

            decodeRoute = function(arg) {
                // if we disabled the routing, dont route!
                if(!active)
                {
                    return;
                }
                // because crossroads cant handle thing:?foo:/bar:?thing:
                // workaround - use 'rest' and deconstruct the arg ourselves..
                if (typeof arg === 'string') {
                    var split = arg.split('?');

                    if(split.length > 1) {
                        // we have query params!!
                        arg = {
                            path: split[0],
                            query: parseQuery('?'+split[1])
                        }
                    } else {
                        arg = {
                            path: split[0] || ''
                        }
                    }
                } else if (arg) {
                    arg = {
                        path: '',
                        query: arg
                    }
                } else {
                    arg = {
                        path: ''
                    }
                }

                if(arg.path.indexOf('/') === arg.path.length -1) {
                    arg.path = arg.path.slice(0, arg.path.length-1);
                }

                routeCallback(arg);
                activeLink(link);
            }

            crossroads.addRoute(route, decodeRoute);

            if (route!==defaultRoute) {
                crossroads.addRoute(defaultRoute, decodeRoute);
            }
        }

        link = {
            navText: navText,
            navigate: function () {
                activeLink(link);
                callback();
            },
            sub: activeLink.subscribe(function(active) {
                if(active === link) {
                   // callback();
                   console.log('do something here');
                }
            }),
            canNav: canNav || function () { return true }
        }

        navLinks.push(link);

        navLinkMap[navText] = link;

        return link;
    }

    function removeNav(navText) {
        navLinkMap[navText].sub.dispose();
        navLinks.remove(navLinkMap[navText]);
        delete navLinkMap[navText];
    }

    function navigate(navText) {
        if(activeLink() !== navLinkMap[navText]) {
            activeLink(navLinkMap[navText]);
        }
    }

    function init() {
        if(navLinks().length !== 0 && !activeLink()) {
            //activeLink(navLinks()[0]);
            navLinks()[0].navigate();
        }
    }

    function parseHash(newHash, oldHash) {
        crossroads.parse(newHash);
    }

    function serialize(obj) {
        var str = [];
        for (var p in obj) {
            if (obj.hasOwnProperty(p)) {
              str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
            }
        }
        return str.join('&');
    }

    function setRoute(url, query, shouldCallback) {
        if(shouldCallback === false) {
            active=false;
        }
        if (query) {
            url += '/?' + serialize(query);
        }
        hasher.setHash(url);
        active = true;
    }

    navigation = {
        navLinks: navLinks,
        activeLink: activeLink,
        navigate: navigate,
        addNav: addNav,
        removeNav: removeNav,
        init: init,
        setRoute: setRoute
    }

    core.registerExtension({
        navigation: navigation,
        layout: {
            content: ko.observable()
        }
    });

    crossroads.routed.add(function (request, data) {
        hasher.setHash(request);
    });

    // reset scroll to top on route
    //crossroads.routed.add(function () {
    //    window.scrollTo(0, 0)
    //});

    hasher.initialized.add(parseHash);
    hasher.changed.add(parseHash);

    core.onApplicationEvent(function (event) {
        if (event === 'started') {
            // wait for all modules to register before initialization
            setTimeout(function () {
                hasher.init();
                navigation.init();
            });
        }
    });

    return navigation;
});

