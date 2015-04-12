/**
 * Copyright 2013, 2014 IBM Corp.
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
var express = require('express');
var fs = require("fs");
var path = require("path");

var theme = require("./theme");

var Mustache = require("mustache");

var events = require("../events");
var settings;

var icon_paths = [path.resolve(__dirname + '/../../public/icons')];
var iconCache = {};
//TODO: create a default icon
var defaultIcon = path.resolve(__dirname + '/../../public/icons/arrow-in.png');

events.on("node-icon-dir",function(dir) {
    icon_paths.push(path.resolve(dir));
});

var templateDir = path.resolve(__dirname+"/../../editor/templates");
var editorTemplate;

module.exports = {
    init: function(_settings) {
        settings = _settings;
        editorTemplate = fs.readFileSync(path.join(templateDir,"index.mst"),"utf8");
        Mustache.parse(editorTemplate);
    },
    
    ensureSlash: function(req,res,next) {
        var parts = req.originalUrl.split("?");
        if (parts[0].slice(-1) != "/") {
            parts[0] += "/";
            var redirect = parts.join("?");
            res.redirect(301,redirect);
        } else {
            next();
        }
    },
    icon: function(req,res) {
        if (iconCache[req.params.icon]) {
            res.sendfile(iconCache[req.params.icon]); // if not found, express prints this to the console and serves 404
        } else { 
            for (var p=0;p<icon_paths.length;p++) {
                var iconPath = path.join(icon_paths[p],req.params.icon);
                if (fs.existsSync(iconPath)) {
                    res.sendfile(iconPath);
                    iconCache[req.params.icon] = iconPath;
                    return;
                }
            }
            res.sendfile(defaultIcon);
        }
    },
    editor: function(req,res) {
        res.send(Mustache.render(editorTemplate,theme.context()));
    },
    editorResources: express.static(__dirname + '/../../public')
};
