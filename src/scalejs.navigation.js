import core from 'scalejs.core';
import ko from 'knockout';
import crossroads from 'crossroads';
import hasher from 'hasher';
import _ from 'lodash';

    var merge = core.object.merge,
        navLinks = ko.observableArray(),
        activeLink = ko.observable(),
        has = core.object.has,
        navLinkMap = {},
        navigation = navigation,
        active = true,
        config = core.type.is(module.config, 'function') ? module.config() || {} : {},
        allowSetHash = has(config.allowSetHash) ? config.allowSetHash : true,
        current = {},
        observableCurrent = ko.observable(current),
        defaultLinkIndex = 0;

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

    function addNav(navOptions, callback) {
        var route, defaultRoute, navCallback, link, decodeRoute,
            navText = navOptions.text,
            routes = [];

        // if not a route, callback is as is
        if(!navOptions.route) {
            navCallback = callback;
        } else {
            // a route will have extra logic in its callbacl
            route = navOptions.route;
            // determine the 'default' route for the link
            // incase we want to have sub-navigations...
            defaultRoute = route.split('/')[0];

            // callback for the navigation
            // tell crossroads to parse the default route when navigation occurs
            navCallback = function () {
                crossroads.parse(defaultRoute);
            }

            // creats the def for the current route
            // route - the default route, e.g. the main route
            // path - the sub path for the route, if any
            // query - the query params in the route
            // url - the full url constructed from all the args
            decodeRoute = function(arg) {
                // because crossroads cant handle thing:?foo:/bar:?thing:
                // workaround - use 'rest' and deconstruct the arg ourselves..
                if (typeof arg === 'string') {
                    // if Arg is a string it is the path plus the serliazed query, so we need to split it
                    var split = arg.split('?');

                    // if the split yields more than 1 result, we have a query param
                    if(split.length > 1) {
                        arg = {
                            route: defaultRoute,
                            path: split[0],
                            query: parseQuery('?'+split[1])
                        }
                    } else {
                        // there is no query param
                        arg = {
                            route: defaultRoute,
                            path: split[0] || ''
                        }
                    }
                } else if (arg) { // if arg is defined but not a string, it is a query object
                    arg = {
                        route: defaultRoute,
                        path: '',
                        query: arg
                    }
                } else { // if arg is not defined at all, it is just the default route
                    arg = {
                        route: defaultRoute,
                        path: ''
                    }
                }

                // remove trailing "/" from path if exists
                if(arg.path[arg.path.length - 1] === '/') {
                    arg.path = arg.path.slice(0, arg.path.length-1);
                }

                // reconstruct the full url from the arg
                arg.url = arg.route + (arg.path ? '/' + arg.path : '') + (arg.query ? '/?' + serialize(arg.query) : '');

                // maintain a current reference to the arg
                current = arg;
                observableCurrent(current);

                // if we disabled the routing, dont route!
                if(!active) {
                    return;
                }

                // call the callback on the route, and set the active link
                callback(arg);
                activeLink(link);
            }

            routes.push(crossroads.addRoute(route, decodeRoute));

            // need to create 2 listeners for more complex routes (e.g. route + path)
            if (route!==defaultRoute) {
                routes.push(crossroads.addRoute(defaultRoute, decodeRoute));
            }
        }

        link = merge(navOptions, {
            navText: navText,
            navigate: function () {
                activeLink(link);
                navCallback();
            },
            routes: routes,
            canNav: navOptions.canNav || function () { return true }
        });

        navLinks.push(link);

        navLinkMap[navText] = link;

        return link;
    }


    function removeNav(navText) {
        // removes nav from nav links, nav link map, and crossroads
       if(navLinkMap[navText]){
           navLinks.remove(navLinkMap[navText]);
           navLinkMap[navText].routes.forEach(function(route) {
               crossroads.removeRoute(route);
           });
           delete navLinkMap[navText];
       }
    }

    function navigate(navText) {
        // sets the active link to the link from map
        if(activeLink() !== navLinkMap[navText]) {
            activeLink(navLinkMap[navText]);
        }
    }

    function init(initial = 0) {
        defaultLinkIndex = initial;
        hasher.init();
        // will set the initial active link if not defined to be the first one
        if(navLinks().length !== 0 && !activeLink()) {
            navLinks()[initial].navigate();
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
        // figure out if the app is trying to set the same route and disregard it
        if (currentUrl === url &&
            JSON.stringify(current.query || {}) === JSON.stringify(query)) {
                console.warn('Trying to set the same route; will be disregarded');
                return;
            }

        // disable the callback for the routing
        if(shouldCallback === false) {
            active=false;
        }
        if (query) {
            url += '/?' + serialize(query);
        }
        // if shouldNotReplace is false, then it should replace instead of create a new history record
        if (shouldNotReplace === false) {
            setHash(url, true);
        } else {
            setHash(url)
        }
        active = true;
    }

    function reRoute() {
        // resets the state of crossroads and reroutes to the latest url
        var url = current.url;
        crossroads.resetState();
        crossroads.parse(url);
    }

    function getCurrent() {
        return _.cloneDeep(observableCurrent());
    }

    function setHash(url, replace) {
        if (allowSetHash) {
           (replace ? hasher.replaceHash : hasher.setHash)(url);
        } else {
            parseHash(url);
        }
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
        reRoute: reRoute,
        serialize: serialize,
        allowSetHash: allowSetHash
    }

    var layout = { content: ko.observable() };

    core.registerExtension({
        navigation: navigation,
        layout: layout
    });

    // when a route is detected, set the hash
    crossroads.routed.add(function (request, data) {
        setHash(request);
    });

    // if a route is bypassed
    // either there are nav links and the nav doesnt exist so nav to the first link (or defaultLinkIndex)
    // or there are no nav links in which case navigation still needs to be set up
    // so store the url in current
    crossroads.bypassed.add(function (request) {
        if(navLinks()[defaultLinkIndex]) {
            navLinks()[defaultLinkIndex].navigate();
        } else {
            current = {
                url: request
            };
            observableCurrent(current);
        }
    });

    hasher.initialized.add(parseHash);
    hasher.changed.add(parseHash);

    // core.onApplicationEvent(function (event) {
    //     if (event === 'started') {
    //         // wait for all modules to register before initialization
    //         setTimeout(function () {
    //             hasher.init();
    //             navigation.init();
    //         });
    //     }
    // });

    export {
        navigation, 
        layout,
        navLinks,
        activeLink,
        navigate,
        addNav,
        removeNav,
        init,
        setRoute,
        getCurrent,
        setCurrent,
        reRoute,
        serialize,
        allowSetHash
    };
