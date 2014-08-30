/**
 * Copyright 2014 IBM Corp.
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

module.exports = function(RED) {
    "use strict";
    function CSVNode(n) {
        RED.nodes.createNode(this,n);
        this.template = n.temp.split(",");
        this.sep = n.sep || ',';
        this.sep = this.sep.replace("\\n","\n").replace("\\r","\r").replace("\\t","\t");
        this.quo = '"';
        var node = this;

        for (var t = 0; t < node.template.length; t++) {
            node.template[t] = node.template[t].trim(); // remove leading and trailing whitespace
            if (node.template[t].charAt(0) === '"' && node.template[t].charAt(node.template[t].length -1) === '"') {
                // remove leading and trialing quotes (if they exist) - and remove whitepace again.
                node.template[t] = node.template[t].substr(1,node.template[t].length -2).trim();
            }
        }

        this.on("input", function(msg) {
            if (msg.hasOwnProperty("payload")) {
                if (typeof msg.payload == "object") { // convert to csv
                    try {
                        var ou = "";
                        for (var t in node.template) {
                            if (msg.payload.hasOwnProperty(node.template[t])) {
                                if (msg.payload[node.template[t]].indexOf(node.sep) != -1) {
                                    ou += node.quo + msg.payload[node.template[t]] + node.quo + node.sep;
                                }
                                else if (msg.payload[node.template[t]].indexOf(node.quo) != -1) {
                                    msg.payload[node.template[t]] = msg.payload[node.template[t]].replace(/"/g, '""');
                                    ou += node.quo + msg.payload[node.template[t]] + node.quo + node.sep;
                                }
                                else { ou += msg.payload[node.template[t]] + node.sep; }
                            }
                        }
                        msg.payload = ou.slice(0,-1);
                        node.send(msg);
                    }
                    catch(e) { node.log(e); }
                }
                else if (typeof msg.payload == "string") { // convert to object
                    try {
                        var f = true;
                        var j = 0;
                        var k = [""];
                        var o = {};
                        for (var i = 0; i < msg.payload.length; i++) {
                            if (msg.payload[i] === node.quo) {
                                f = !f;
                                if (msg.payload[i-1] === node.quo) { k[j] += '\"'; }
                            }
                            else if ((msg.payload[i] === node.sep) && f) {
                                if ( node.template[j] && (node.template[j] !== "") ) { o[node.template[j]] = k[j]; }
                                j += 1;
                                k[j] = "";
                            }
                            else {
                                k[j] += msg.payload[i];
                            }
                        }
                        if ( node.template[j] && (node.template[j] !== "") ) { o[node.template[j]] = k[j]; }
                        msg.payload = o;
                        node.send(msg);
                    }
                    catch(e) { node.log(e); }
                }
                else { node.log("This node only handles csv strings or js objects."); }
            }
        });
    }
    RED.nodes.registerType("csv",CSVNode);
}
