/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var clone = require("clone");
var util = require("../../util");
var log = require("../../log");

var settings;
var contexts = {};
var globalContext = null;
var externalContexts = {};
var noContextStorage = false;

function init(_settings) {
    settings = _settings;
    externalContexts = {};

    // init memory plugin
    externalContexts["_"] = require("./memory");
    externalContexts["_"].init();
    globalContext = createContext("global",settings.functionGlobalContext || {});
}

function load() {
    // load & init plugins in settings.contextStorage
    var plugins = settings.contextStorage;
    var alias = null;
    if (plugins) {
        noContextStorage = false;
        for(var pluginName in plugins){
            if(pluginName === "_"){
                continue;
            }
            if(pluginName === "default" && typeof plugins[pluginName] === "string"){
                alias = plugins[pluginName];
                continue;
            }
            var plugin;
            if(plugins[pluginName].hasOwnProperty("module")){
                var config = plugins[pluginName].config || {};
                copySettings(config, settings);
                if(typeof plugins[pluginName].module === "string") {
                    try{
                        plugin = require("./"+plugins[pluginName].module);
                    }catch(err){
                        throw new Error(log._("context.error-module-not-loaded", {module:plugins[pluginName].module}));
                    }
                } else {
                    plugin = plugins[pluginName].module;
                }
                plugin.init(config);
                externalContexts[pluginName] = plugin;
            }else{
                throw new Error(log._("context.error-module-not-defined", {storage:pluginName}));
            }
        }
        if(alias){
            if(externalContexts.hasOwnProperty(alias)){
                externalContexts["default"] = externalContexts[alias];
            }else{
                throw new Error(log._("context.error-invalid-default-module", {storage:plugins["default"]}));
            }
        }
    } else {
        noContextStorage = true;
    }
}

function copySettings(config, settings){
    var copy = ["userDir"]
    config.settings = {};
    copy.forEach(function(setting){
        config.settings[setting] = clone(settings[setting]);
    });
}

function parseStorage(key) {
    if (!key || key.charAt(0) !== '$') {
        return "";
    } else {
        var endOfStorageName = key.indexOf(".");
        if (endOfStorageName == -1) {
            endOfStorageName = key.length;
        }
        return key.substring(1,endOfStorageName)||"default";
    }
}

function parseKey(key) {
    if (!key) {
        throw new Error(log._("context.error-key-zero-length"));
    }
    var indexSpace = key.indexOf(" ");
    if (indexSpace != -1) {
        throw new Error(log._("context.error-unexpected-space-character", {index:indexSpace}));
    }
    var keyPath = { storage: "", key: "" };
    var indexDot = key.indexOf(".");
    // The key of "$file" should be treated as a key without persistable context.
    if (indexDot != -1) {
        keyPath.storage = parseStorage(key);
    }
    if (keyPath.storage) {
        keyPath.key = key.substring(indexDot + 1);
    } else {
        keyPath.key = key;
    }
    if(!keyPath.key) {
        throw new Error(log._("context.error-empty-key"));
    }
    return keyPath;
}

function getContextStorage(storage) {
    if (noContextStorage || !storage) {
        return externalContexts["_"];
    } else if (externalContexts.hasOwnProperty(storage)) {
        return externalContexts[storage];
    } else if (externalContexts.hasOwnProperty("default")) {
        return externalContexts["default"];
    } else {
        var contextError = new Error(log._("context.error-use-undefined-storage", {storage:storage}));
        contextError.name = "ContextError";
        throw contextError;
    }
}

function createContext(id,seed) {
    var scope = id;
    var obj = seed || {};

    obj.get = function(key) {
        var keyPath = parseKey(key);
        var context = getContextStorage(keyPath.storage);
        return context.get(keyPath.key, scope);
    };
    obj.set = function(key, value) {
        var keyPath = parseKey(key);
        var context = getContextStorage(keyPath.storage);
        return context.set(keyPath.key, value, scope);
    };
    obj.keys = function(storage) {
        //TODO: discuss about keys() behavior
        var storageName = parseStorage(storage);
        var context = getContextStorage(storageName);
        return context.keys(scope);
    };
    if(id === "global"){
        externalContexts["_"].setGlobalContext(seed);
    }
    return obj;
}

function getContext(localId,flowId) {
    var contextId = localId;
    if (flowId) {
        contextId = localId+":"+flowId;
    }
    if (contexts.hasOwnProperty(contextId)) {
        return contexts[contextId];
    }
    var newContext = createContext(contextId);
    if (flowId) {
        newContext.flow = getContext(flowId);
    }
    if (globalContext) {
        newContext.global = globalContext;
    }
    contexts[contextId] = newContext;
    return newContext;
}

function deleteContext(id,flowId) {
    var contextId = id;
    if (flowId) {
        contextId = id+":"+flowId;
    }
    for(var plugin in externalContexts){
        externalContexts[plugin].delete(contextId);
    }
    delete contexts[contextId];
}

function clean(flowConfig) {
    var activeIds = {};
    var contextId;
    var node;
    for (var id in contexts) {
        if (contexts.hasOwnProperty(id)) {
            var idParts = id.split(":");
            if (!flowConfig.allNodes.hasOwnProperty(idParts[0])) {
                for(var plugin in externalContexts){
                    externalContexts[plugin].delete(id);
                }
                delete contexts[id];
            }
        }
    }
}

module.exports = {
    init: init,
    load: load,
    get: getContext,
    delete: deleteContext,
    clean:clean
};
