
define('scalejs.navigation',[
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
        active = true,
        current;

    function parseQuery(qstr) {
        var query = {}, parsed;
        var a = qstr.substr(1).split('&');
        for (var i = 0; i < a.length; i = i+1 ) {
            var b = a[i].split('=');

            query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '');
            try {
                query[decodeURIComponent(b[0])] = JSON.parse(query[decodeURIComponent(b[0])])
            }
            catch(ignore) {
                //if it's already a string, we don't need to do anything
            }
        }
        Object.keys(query).forEach(function(key) {
            // TODO: implement better typecasting
            if (query[key] === 'true') {
                query[key] = true;
            }
            else if (query[key] === 'false') {
                query[key] = false;
            }
            else if (typeof query[key] === 'string' && query[key].indexOf(',') !== -1) {
               query[key] = query[key].split(',');
            }
        })
        return query;
    }

    function addNav(navText, routeOrCallback, routeCallback, canNav) {
        var route, link, callback, defaultRoute, decodeRoute, routes = [];

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
                // because crossroads cant handle thing:?foo:/bar:?thing:
                // workaround - use 'rest' and deconstruct the arg ourselves..
                if (typeof arg === 'string') {
                    var split = arg.split('?');

                    if(split.length > 1) {
                        // we have query params!!
                        arg = {
                            route: defaultRoute,
                            path: split[0],
                            query: parseQuery('?'+split[1])
                        }
                    } else {
                        arg = {
                            route: defaultRoute,
                            path: split[0] || ''
                        }
                    }
                } else if (arg) {
                    arg = {
                        route: defaultRoute,
                        path: '',
                        query: arg
                    }
                } else {
                    arg = {
                        route: defaultRoute,
                        path: ''
                    }
                }

                if(arg.path[arg.path.length - 1] === '/') {
                    arg.path = arg.path.slice(0, arg.path.length-1);
                }

                current = arg;

                // if we disabled the routing, dont route!
                if(!active) {
                    return;
                }

                routeCallback(arg);
                activeLink(link);
            }

            routes.push(crossroads.addRoute(route, decodeRoute));

            if (route!==defaultRoute) {
                routes.push(crossroads.addRoute(defaultRoute, decodeRoute));
            }
        }

        link = {
            navText: navText,
            navigate: function () {
                activeLink(link);
                callback();
            },
            routes: routes,
            canNav: canNav || function () { return true }
        }

        navLinks.push(link);

        navLinkMap[navText] = link;

        return link;
    }


    function removeNav(navText) {
       if(navLinkMap[navText]){
           navLinks.remove(navLinkMap[navText]);
           navLinkMap[navText].routes.forEach(function(route) {
               crossroads.removeRoute(route);
           });
           delete navLinkMap[navText];
       }
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
              str.push(encodeURIComponent(p) + '=' + encodeURIComponent(typeof obj[p] === 'string' ? obj[p] : JSON.stringify(obj[p])));
            }
        }
        return str.join('&');
    }

    function setRoute(url, query, shouldCallback, shouldNotReplace) {
        var currentUrl = current.route + (current.path ? '/' + current.path : '');
        if (currentUrl === url &&
            JSON.stringify(current.query || {}) === JSON.stringify(query)) {
                console.warn('Trying to set the same route; will be disregarded');
                return;
            }

        if(shouldCallback === false) {
            active=false;
        }
        if (query) {
            url += '/?' + serialize(query);
        }
        if (shouldNotReplace === false) {
            hasher.replaceHash(url);
        } else {
            hasher.setHash(url);
        }
        active = true;
    }
    
    function reRoute() {
        var url = current.route + (current.path ? '/' + current.path : '');
        if(current.query) {
            url += '/?' + serialize(current.query);
        }
        crossroads.resetState();
        crossroads.parse(url);
    }

    function getCurrent() {
        return current;
    }

    navigation = {
        navLinks: navLinks,
        activeLink: activeLink,
        navigate: navigate,
        addNav: addNav,
        removeNav: removeNav,
        init: init,
        setRoute: setRoute,
        getCurrent: getCurrent,
        reRoute: reRoute
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




