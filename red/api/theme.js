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

var express = require("express");
var util = require("util");
var path = require("path");
var fs = require("fs");

var themeContext = {
    page: {
        title: "Node-RED",
        favicon: "favicon.ico"
        //css: [""]
    },
    header: {
        title: "Node-RED",
        image: "red/images/node-red.png"
    }
};

var themeSettings = null;

function serveFile(app,baseUrl,file) {
    try {
        var stats = fs.statSync(file);
        var url = baseUrl+path.basename(file);
        //console.log(url,"->",file);
        app.get(url,function(req, res) {
            res.sendfile(file);
        });
        return url;
    } catch(err) {
        //TODO: log filenotfound
        return null;
    }
}

module.exports = {
    init: function(settings) {
        var i;
        var url;
        if (settings.editorTheme) {
            var theme = settings.editorTheme;
            themeSettings = {};
            
            var themeApp = express();
            
            if (theme.page) {
                if (theme.page.css) {
                    var styles = theme.page.css;
                    if (!util.isArray(styles)) {
                        styles = [styles];
                    }
                    themeContext.page.css = [];
                    
                    for (i=0;i<styles.length;i++) {
                        url = serveFile(themeApp,"/css/",styles[i]);
                        if (url) {
                            themeContext.page.css.push("/theme"+url);
                        }
                    }
                }
                
                if (theme.page.favicon) {
                    url = serveFile(themeApp,"/favicon/",theme.page.favicon)
                    if (url) {
                        themeContext.page.favicon = "/theme"+url;
                    }
                }
                
                themeContext.page.title = theme.page.title || themeContext.page.title;
            }
            
            if (theme.header) {
                
                themeContext.header.title = theme.header.title || themeContext.header.title;
                if (theme.header.hasOwnProperty("image")) {
                    if (theme.header.image) {
                        url = serveFile(themeApp,"/header/",theme.header.image);
                        if (url) {
                            themeContext.header.image = "/theme"+url;
                        }
                    } else {
                        themeContext.header.image = null;
                    }
                }
            }
            
            //themeSettings.deployButton = theme.deployButton || themeSettings.deployButton;
            
            return themeApp;
        }
    },
    context: function() {
        return themeContext;
    },
    settings: function() {
        return themeSettings;
    }
}
