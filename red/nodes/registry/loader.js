/**
 * Copyright 2015 IBM Corp.
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

var when = require("when");
var fs = require("fs");
var path = require("path");


var localfilesystem = require("./localfilesystem");
var registry = require("./registry");

var settings;


function init(_settings) {
    settings = _settings;
    localfilesystem.init(settings);
}

function load(defaultNodesDir,disableNodePathScan) {
    var nodeFiles = localfilesystem.getNodeFiles(defaultNodesDir,disableNodePathScan);
    return loadNodeFiles(nodeFiles);
}

function loadNodeFiles(nodeFiles) {
    var nodes = [];
    for (var module in nodeFiles) {
        /* istanbul ignore else */
        if (nodeFiles.hasOwnProperty(module)) {
            if (!registry.getModuleInfo(module)) {
                for (var node in nodeFiles[module].nodes) {
                    /* istanbul ignore else */
                    if (nodeFiles[module].nodes.hasOwnProperty(node)) {
                        try {
                            nodes.push(loadNodeConfig(nodeFiles[module].nodes[node]))
                        } catch(err) {
                            //
                        }
                    }
                }
            }
        }
    }
    return loadNodeSetList(nodes);
}

function loadNodeConfig(fileInfo) {
    var file = fileInfo.file;
    var module = fileInfo.module;
    var name = fileInfo.name;
    var version = fileInfo.version;
    
    var id = module + "/" + name;
    var info = registry.getNodeInfo(id);
    var isEnabled = true;
    if (info) {
        if (info.hasOwnProperty("loaded")) {
            throw new Error(file+" already loaded");
        }
        isEnabled = info.enabled;
    }

    var node = {
        id: id,
        module: module,
        name: name,
        file: file,
        template: file.replace(/\.js$/,".html"),
        enabled: isEnabled,
        loaded:false
    };

    try {
        var content = fs.readFileSync(node.template,'utf8');

        var types = [];

        var regExp = /<script ([^>]*)data-template-name=['"]([^'"]*)['"]/gi;
        var match = null;

        while((match = regExp.exec(content)) !== null) {
            types.push(match[2]);
        }
        node.types = types;
        node.config = content;

        // TODO: parse out the javascript portion of the template
        //node.script = "";
        for (var i=0;i<node.types.length;i++) {
            if (registry.getTypeId(node.types[i])) {
                node.err = node.types[i]+" already registered";
                break;
            }
        }
    } catch(err) {
        node.types = [];
        if (err.code === 'ENOENT') {
            node.err = "Error: "+file+" does not exist";
        } else {
            node.err = err.toString();
        }
    }

    registry.addNodeSet(id,node,version);
    return node;
}



/**
 * Loads the specified node into the runtime
 * @param node a node info object - see loadNodeConfig
 * @return a promise that resolves to an update node info object. The object
 *         has the following properties added:
 *            err: any error encountered whilst loading the node
 *
 */
function loadNodeSet(node) {
    var nodeDir = path.dirname(node.file);
    var nodeFn = path.basename(node.file);
    if (!node.enabled) {
        return when.resolve(node);
    }
    try {
        var loadPromise = null;
        var r = require(node.file);
        if (typeof r === "function") {
            var promise = r(require('../../red'));
            if (promise != null && typeof promise.then === "function") {
                loadPromise = promise.then(function() {
                    node.enabled = true;
                    node.loaded = true;
                    return node;
                }).otherwise(function(err) {
                    node.err = err;
                    return node;
                });
            }
        }
        if (loadPromise == null) {
            node.enabled = true;
            node.loaded = true;
            loadPromise = when.resolve(node);
        }
        return loadPromise;
    } catch(err) {
        node.err = err;
        return when.resolve(node);
    }
}

function loadNodeSetList(nodes) {
    var promises = [];
    nodes.forEach(function(node) {
        if (!node.err) {
            promises.push(loadNodeSet(node));
        } else {
            promises.push(node);
        }
    });

    return when.settle(promises).then(function() {
        if (settings.available()) {
            return registry.saveNodeList();
        } else {
            return;
        }
    });
}

function addModule(module) {
    if (!settings.available()) {
        throw new Error("Settings unavailable");
    }
    var nodes = [];
    if (registry.getModuleInfo(module)) {
        return when.reject(new Error("Module already loaded"));
    }
    try {
        var moduleFiles = localfilesystem.getModuleFiles(module);
        return loadNodeFiles(moduleFiles);
    } catch(err) {
        return when.reject(err);
    }
}

module.exports = {
    init: init,
    load: load,
    addModule: addModule,
    loadNodeSet: loadNodeSet
}
