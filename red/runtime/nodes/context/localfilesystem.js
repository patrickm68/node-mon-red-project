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

/**
 * Local file-system based context storage
 *
 * Configuration options:
 * {
 *    base: "context",         // the base directory to use
 *                             // default: "context"
 *    dir: "/path/to/storage", // the directory to create the base directory in
 *                             // default: settings.userDir
 *    cache: true,             // whether to cache contents in memory
 *                             // default: true
 *    flushInterval: 30        // if cache is enabled, the minimum interval
 *                             // between writes to storage, in seconds. This
 *                                can be used to reduce wear on underlying storage.
 *                                default: 30 seconds
 *  }
 *
 *
 *  $HOME/.node-red/contexts
 *  ├── global
 *  │     └── global_context.json
 *  ├── <id of Flow 1>
 *  │     ├── flow_context.json
 *  │     ├── <id of Node a>.json
 *  │     └── <id of Node b>.json
 *  └── <id of Flow 2>
 *         ├── flow_context.json
 *         ├── <id of Node x>.json
 *         └── <id of Node y>.json
 */

var fs = require('fs-extra');
var path = require("path");
var util = require("../../util");

var MemoryStore = require("./memory");

function getStoragePath(storageBaseDir, scope) {
    if(scope.indexOf(":") === -1){
        if(scope === "global"){
            return path.join(storageBaseDir,"global",scope);
        }else{ // scope:flow
            return path.join(storageBaseDir,scope,"flow");
        }
    }else{ // scope:local
        var ids = scope.split(":")
        return path.join(storageBaseDir,ids[1],ids[0]);
    }
}

function getBasePath(config) {
    var base = config.base || "context";
    var storageBaseDir;
    if (!config.dir) {
        if(config.settings && config.settings.userDir){
            storageBaseDir = path.join(config.settings.userDir, base);
        }else{
            try {
                fs.statSync(path.join(process.env.NODE_RED_HOME,".config.json"));
                storageBaseDir = path.join(process.env.NODE_RED_HOME, base);
            } catch(err) {
                try {
                    // Consider compatibility for older versions
                    if (process.env.HOMEPATH) {
                        fs.statSync(path.join(process.env.HOMEPATH,".node-red",".config.json"));
                        storageBaseDir = path.join(process.env.HOMEPATH, ".node-red", base);
                    }
                } catch(err) {
                }
                if (!storageBaseDir) {
                    storageBaseDir = path.join(process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH || process.env.NODE_RED_HOME,".node-red", base);
                }
            }
        }
    }else{
        storageBaseDir = path.join(config.dir, base);
    }
    return storageBaseDir;
}

function loadFile(storagePath){
    return fs.pathExists(storagePath).then(function(exists){
        if(exists === true){
            return fs.readFile(storagePath, "utf8");
        }else{
            return Promise.resolve(undefined);
        }
    }).catch(function(err){
        throw Promise.reject(err);
    });
}

function listFiles(storagePath) {
    var promises = [];
    return fs.readdir(storagePath).then(function(files) {
        files.forEach(function(file) {
            promises.push(fs.readdir(path.join(storagePath,file)).then(function(subdirFiles) {
                return subdirFiles.map(subfile => path.join(file,subfile));
            }))
        });
        return Promise.all(promises);
    }).then(dirs => dirs.reduce((acc, val) => acc.concat(val), []));
}

function LocalFileSystem(config){
    this.config = config;
    this.storageBaseDir = getBasePath(this.config);
    if (config.hasOwnProperty('cache')?config.cache:true) {
        this.cache = MemoryStore({});
    }
    this.pendingWrites = {};
    if (config.hasOwnProperty('flushInterval')) {
        this.flushInterval = Math.max(0,config.flushInterval) * 1000;
    } else {
        this.flushInterval = 30000;
    }
}

LocalFileSystem.prototype.open = function(){
    var self = this;
    if (this.cache) {
        var scopes = [];
        var promises = [];
        return listFiles(self.storageBaseDir).then(function(files) {
            files.forEach(function(file) {
                var parts = file.split("/");
                if (parts[0] === 'global') {
                    scopes.push("global");
                } else if (parts[1] === 'flow.json') {
                    scopes.push(parts[0])
                } else {
                    scopes.push(parts[1].substring(0,parts[1].length-5)+":"+parts[0]);
                }
                promises.push(loadFile(path.join(self.storageBaseDir,file)));
            })
            return Promise.all(promises);
        }).then(function(res) {
            scopes.forEach(function(scope,i) {
                var data = res[i]?JSON.parse(res[i]):{};
                Object.keys(data).forEach(function(key) {
                    self.cache.set(scope,key,data[key]);
                })
            });
        }).catch(function(err){
            if(err.code == 'ENOENT') {
                return fs.ensureDir(self.storageBaseDir);
            }else{
                return Promise.reject(err);
            }
        }).then(function() {
            self._flushPendingWrites = function() {
                var scopes = Object.keys(self.pendingWrites);
                self.pendingWrites = {};
                var promises = [];
                var newContext = self.cache._export();
                scopes.forEach(function(scope) {
                    var storagePath = getStoragePath(self.storageBaseDir,scope);
                    var context = newContext[scope];
                    promises.push(fs.outputFile(storagePath + ".json", JSON.stringify(context, undefined, 4), "utf8"));
                });
                delete self._pendingWriteTimeout;
                return Promise.all(promises);
            }
        });
    } else {
        return fs.ensureDir(self.storageBaseDir);
    }
}

LocalFileSystem.prototype.close = function(){
    if (this.cache && this._flushPendingWrites) {
        clearTimeout(this._pendingWriteTimeout);
        delete this._pendingWriteTimeout;
        return this._flushPendingWrites();
    }
    return Promise.resolve();
}

LocalFileSystem.prototype.get = function(scope, key, callback) {
    if (this.cache) {
        return this.cache.get(scope,key,callback);
    }
    if(typeof callback !== "function"){
        throw new Error("Callback must be a function");
    }
    var storagePath = getStoragePath(this.storageBaseDir ,scope);
    loadFile(storagePath + ".json").then(function(data){
        if(data){
            data = JSON.parse(data);
            if (!Array.isArray(key)) {
                callback(null, util.getObjectProperty(data,key));
            } else {
                var results = [undefined];
                for (var i=0;i<key.length;i++) {
                    results.push(util.getObjectProperty(data,key[i]))
                }
                callback.apply(null,results);
            }
        }else{
            callback(null, undefined);
        }
    }).catch(function(err){
        callback(err);
    });
};

LocalFileSystem.prototype.set = function(scope, key, value, callback) {
    var storagePath = getStoragePath(this.storageBaseDir ,scope);
    if (this.cache) {
        this.cache.set(scope,key,value,callback);
        this.pendingWrites[scope] = true;
        if (this._pendingWriteTimeout) {
            // there's a pending write which will handle this
            return;
        } else {
            var self = this;
            this._pendingWriteTimeout = setTimeout(function() { self._flushPendingWrites.call(self)}, this.flushInterval);
        }
    } else if (callback && typeof callback !== 'function') {
        throw new Error("Callback must be a function");
    } else {
        loadFile(storagePath + ".json").then(function(data){
            var obj = data ? JSON.parse(data) : {}
            if (!Array.isArray(key)) {
                key = [key];
                value = [value];
            } else if (!Array.isArray(value)) {
                // key is an array, but value is not - wrap it as an array
                value = [value];
            }
            for (var i=0;i<key.length;i++) {
                var v = null;
                if (i<value.length) {
                    v = value[i];
                }
                util.setObjectProperty(obj,key[i],v);
            }
            return fs.outputFile(storagePath + ".json", JSON.stringify(obj, undefined, 4), "utf8");
        }).then(function(){
            if(typeof callback === "function"){
                callback(null);
            }
        }).catch(function(err){
            if(typeof callback === "function"){
                callback(err);
            }
        });
    }
};

LocalFileSystem.prototype.keys = function(scope, callback){
    if (this.cache) {
        return this.cache.keys(scope,callback);
    }
    if(typeof callback !== "function"){
        throw new Error("Callback must be a function");
    }
    var storagePath = getStoragePath(this.storageBaseDir ,scope);
    loadFile(storagePath + ".json").then(function(data){
        if(data){
            callback(null, Object.keys(JSON.parse(data)));
        }else{
            callback(null, []);
        }
    }).catch(function(err){
        callback(err);
    });
};

LocalFileSystem.prototype.delete = function(scope){
    var cachePromise;
    if (this.cache) {
        cachePromise = this.cache.delete(scope);
    } else {
        cachePromise = Promise.resolve();
    }
    var that = this;
    delete this.pendingWrites[scope];
    return cachePromise.then(function() {
        var storagePath = getStoragePath(that.storageBaseDir,scope);
        return fs.remove(storagePath + ".json");
    });
}

LocalFileSystem.prototype.clean = function(_activeNodes) {
    var activeNodes = {};
    _activeNodes.forEach(function(node) { activeNodes[node] = true });
    var self = this;
    var cachePromise;
    if (this.cache) {
        cachePromise = this.cache.clean(_activeNodes);
    } else {
        cachePromise = Promise.resolve();
    }
    return cachePromise.then(() => listFiles(self.storageBaseDir)).then(function(files) {
        var promises = [];
        files.forEach(function(file) {
            var parts = file.split("/");
            var removePromise;
            if (parts[0] === 'global') {
                // never clean global
                return;
            } else if (!activeNodes[parts[0]]) {
                // Flow removed - remove the whole dir
                removePromise = fs.remove(path.join(self.storageBaseDir,parts[0]));
            } else if (parts[1] !== 'flow.json' && !activeNodes[parts[1].substring(0,parts[1].length-5)]) {
                // Node removed - remove the context file
                removePromise = fs.remove(path.join(self.storageBaseDir,file));
            }
            if (removePromise) {
                promises.push(removePromise);
            }
        });
        return Promise.all(promises)
    })
}

module.exports = function(config){
    return new LocalFileSystem(config);
};
