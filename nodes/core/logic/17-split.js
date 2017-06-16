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

module.exports = function(RED) {
    "use strict";

    function sendArray(node,msg,array) {
        for (var i = 0; i < array.length; i++) {
            msg.payload = array[i];
            msg.parts.index = i;
            msg.parts.count = array.length;
            //if (i === a.length-1) { msg.complete = true; }
            node.send(RED.util.cloneMessage(msg));
        }
    }
    function SplitNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.stream = n.stream;
        node.spltType = n.spltType || "str";
        try {
            if (node.spltType === "str") {
                this.splt = (n.splt || "\\n").replace(/\\n/,"\n").replace(/\\r/,"\r").replace(/\\t/,"\t").replace(/\\e/,"\e").replace(/\\f/,"\f").replace(/\\0/,"\0");
            } else if (node.spltType === "bin") {
                var spltArray = JSON.parse(n.splt);
                if (Array.isArray(spltArray)) {
                    this.splt = Buffer.from(spltArray);
                } else {
                    throw new Error("not an array");
                }
                this.spltBuffer = spltArray;
            } else if (node.spltType === "len") {
                this.splt = parseInt(n.splt);
                if (isNaN(this.splt) || this.splt < 1) {
                    throw new Error("invalid split length: "+n.splt);
                }
            }
            this.arraySplt = (n.arraySplt === undefined)?1:parseInt(n.arraySplt);
            if (isNaN(this.arraySplt) || this.arraySplt < 1) {
                throw new Error("invalid array split length: "+n.arraySplt);
            }
        } catch(err) {
            this.error("Invalid split property: "+err.toString());
            return;
        }
        node.c = 0;
        node.buffer = new Buffer([]);
        this.on("input", function(msg) {
            if (msg.hasOwnProperty("payload")) {
                var a = msg.payload;
                if (msg.hasOwnProperty("parts")) { msg.parts = { parts:msg.parts }; } // push existing parts to a stack
                else { msg.parts = {}; }
                msg.parts.id = msg._msgid;  // use the existing _msgid by default.
                if (typeof msg.payload === "string") { // Split String into array
                    msg.parts.type = "string";
                    if (node.spltType === "len") {
                        // a = msg.payload.match()
                        msg.parts.ch = "";
                        var count = msg.payload.length/node.splt;
                        if (Math.floor(count) !== count) {
                            // Partial last packet
                            //TODO stream support
                            count = Math.ceil(count);
                        }
                        msg.parts.count = count;
                        var pos = 0;
                        var data = msg.payload;
                        for (var i=0; i<count; i++) {
                            msg.payload = data.substring(pos,pos+node.splt);
                            msg.parts.index = i;
                            pos += node.splt;
                            node.send(RED.util.cloneMessage(msg));
                        }
                    } else {
                        var a = [];
                        if (node.spltType === "bin") {
                            if (!node.spltBufferString) {
                                node.spltBufferString = node.splt.toString();
                            }
                            a = msg.payload.split(node.spltBufferString);
                            msg.parts.ch = node.spltBuffer; // pass the split char to other end for rejoin
                        } else if (node.spltType === "str") {
                            a = msg.payload.split(node.splt);
                            msg.parts.ch = node.splt; // pass the split char to other end for rejoin
                        }
                        sendArray(node,msg,a);
                    }
                } else if (Array.isArray(msg.payload)) { // then split array into messages
                    msg.parts.type = "array";
                    var count = msg.payload.length/node.arraySplt;
                    if (Math.floor(count) !== count) {
                        // Partial last packet
                        //TODO stream support
                        count = Math.ceil(count);
                    }
                    msg.parts.count = count;
                    var pos = 0;
                    var data = msg.payload;
                    msg.parts.len = node.arraySplt;
                    for (var i=0; i<count; i++) {
                        msg.payload = data.slice(pos,pos+node.arraySplt);
                        if (node.arraySplt === 1) {
                            msg.payload = msg.payload[0];
                        }
                        msg.parts.index = i;
                        pos += node.arraySplt;
                        node.send(RED.util.cloneMessage(msg));
                    }
                } else if ((typeof msg.payload === "object") && !Buffer.isBuffer(msg.payload)) {
                    var j = 0;
                    var l = Object.keys(msg.payload).length;
                    var pay = msg.payload;
                    msg.parts.type = "object";
                    for (var p in pay) {
                        if (pay.hasOwnProperty(p)) {
                            msg.payload = pay[p];
                            msg.parts.key = p;
                            msg.parts.index = j;
                            msg.parts.count = l;
                            node.send(RED.util.cloneMessage(msg));
                            j += 1;
                        }
                    }
                } else if (Buffer.isBuffer(msg.payload)) {
                    msg.parts.type = "buffer";
                    if (node.spltType === "len") {
                        var count = msg.payload.length/node.splt;
                        if (Math.floor(count) !== count) {
                            // Partial last packet
                            //TODO stream support
                            count = Math.ceil(count);
                        }
                        msg.parts.count = count;
                        var pos = 0;
                        var data = msg.payload;
                        msg.parts.len = node.splt;
                        for (var i=0; i<count; i++) {
                            msg.payload = data.slice(pos,pos+node.splt);
                            msg.parts.index = i;
                            pos += node.splt;
                            node.send(RED.util.cloneMessage(msg));
                        }
                    } else {
                        var count = 0;
                        if (node.spltType === "bin") {
                            msg.parts.ch = node.spltBuffer;
                        } else if (node.spltType === "str") {
                            msg.parts.ch = node.splt;
                        }
                        var pos = msg.payload.indexOf(node.splt);
                        var end;
                        while (pos > -1) {
                            count++;
                            end = pos+node.splt.length;
                            pos = msg.payload.indexOf(node.splt,end);
                        }
                        //TODO: stream support
                        // if (end < msg.payload.length) {
                            count++;
                        // }
                        msg.parts.count = count;
                        var i = 0, p = 0;
                        var data = msg.payload;
                        pos = data.indexOf(node.splt);
                        while (pos > -1) {
                            msg.payload = data.slice(p,pos);
                            msg.parts.index = i;
                            node.send(RED.util.cloneMessage(msg));
                            i++;
                            p = pos+node.splt.length;
                            pos = data.indexOf(node.splt,p);
                        }
                        // if (p < data.length) {
                            // TODO: stream support;
                            msg.payload = data.slice(p,data.length);
                            msg.parts.index = i;
                            node.send(RED.util.cloneMessage(msg));
                        // }

                    }

                    // var len = /*node.buffer.length + */ msg.payload.length;
                    // var buff = Buffer.concat([/*node.buffer,*/ msg.payload], len);
                    // var pos = buff.indexOf(node.splt);
                    // msg.parts.type = "buffer";
                    // msg.parts.ch = node.splt; // pass the split to other end for rejoin
                    // while (pos !== -1) {
                    //     msg.payload = buff.slice(0,pos);
                    //     msg.parts.index = node.c;
                    //     node.c += 1;
                    //     buff = buff.slice(pos + node.splt.length);
                    //     if (buff.length === 0) {
                    //         msg.parts.count = node.c;
                    //         node.c = 0; //reset the count if no remainder.
                    //     }
                    //     node.send(RED.util.cloneMessage(msg));
                    //     pos = buff.indexOf(node.splt);
                    // }
                    // // save the remainder to use as start of next time round
                    // node.buffer = buff;
                }
                //else {  }   // otherwise drop the message.
            }
        });
    }
    RED.nodes.registerType("split",SplitNode);


    function JoinNode(n) {
        RED.nodes.createNode(this,n);
        this.mode = n.mode||"auto";
        this.property = n.property||"payload";
        this.propertyType = n.propertyType||"msg";
        if (this.propertyType === 'full') {
            this.property = "payload";
        }
        this.key = n.key||"topic";
        this.timer = (this.mode === "auto") ? 0 : Number(n.timeout || 0)*1000;
        this.count = Number(n.count || 0);
        this.joiner = (n.joiner||"").replace(/\\n/g,"\n").replace(/\\r/g,"\r").replace(/\\t/g,"\t").replace(/\\e/g,"\e").replace(/\\f/g,"\f").replace(/\\0/g,"\0");
        this.build = n.build || "array";
        this.accumulate = n.accumulate || "false";
        //this.topic = n.topic;
        var node = this;
        var inflight = {};

        var completeSend = function(partId) {
            var group = inflight[partId];
            clearTimeout(group.timeout);
            if ((node.accumulate !== true) || group.msg.hasOwnProperty("complete")) { delete inflight[partId]; }
            if (group.type === 'array' && group.arrayLen > 1) {
                var newArray = [];
                group.payload.forEach(function(n) {
                    newArray = newArray.concat(n);
                })
                group.payload = newArray;
            } else if (group.type === 'buffer') {
                var buffers = [];
                var bufferLen = 0;
                if (group.joinChar !== undefined) {
                    var joinBuffer = Buffer.from(group.joinChar);
                    for (var i=0; i<group.payload.length; i++) {
                        if (i > 0) {
                            buffers.push(joinBuffer);
                            bufferLen += joinBuffer.length;
                        }
                        buffers.push(group.payload[i]);
                        bufferLen += group.payload[i].length;
                    }
                } else {
                    bufferLen = group.bufferLen;
                    buffers = group.payload;
                }
                group.payload = Buffer.concat(buffers,bufferLen);
            }

            if (group.type === 'string') {
                RED.util.setMessageProperty(group.msg,node.property,group.payload.join(group.joinChar));
            } else {
                RED.util.setMessageProperty(group.msg,node.property,group.payload);
            }
            if (group.msg.hasOwnProperty('parts') && group.msg.parts.hasOwnProperty('parts')) {
                group.msg.parts = group.msg.parts.parts;
            } else {
                delete group.msg.parts;
            }
            delete group.msg.complete;
            node.send(group.msg);
        }

        this.on("input", function(msg) {
            try {
                var property;
                if (node.mode === 'auto' && (!msg.hasOwnProperty("parts")||!msg.parts.hasOwnProperty("id"))) {
                    node.warn("Message missing msg.parts property - cannot join in 'auto' mode")
                    return;
                }
                if (node.propertyType == "full") {
                    property = msg;
                }
                else {
                    try {
                        property = RED.util.getMessageProperty(msg,node.property);
                    } catch(err) {
                        node.warn("Message property "+node.property+" not found");
                        return;
                    }
                }

                var partId;
                var payloadType;
                var propertyKey;
                var targetCount;
                var joinChar;
                var arrayLen;
                var propertyIndex;
                if (node.mode === "auto") {
                    // Use msg.parts to identify all of the group information
                    partId = msg.parts.id;
                    payloadType = msg.parts.type;
                    targetCount = msg.parts.count;
                    joinChar = msg.parts.ch;
                    propertyKey = msg.parts.key;
                    arrayLen = msg.parts.len;
                    propertyIndex = msg.parts.index;
                }
                else {
                    // Use the node configuration to identify all of the group information
                    partId = "_";
                    payloadType = node.build;
                    targetCount = node.count;
                    joinChar = node.joiner;
                    if (targetCount === 0 && msg.hasOwnProperty('parts')) {
                        targetCount = msg.parts.count || 0;
                    }
                    if (node.build === 'object') {
                        propertyKey = RED.util.getMessageProperty(msg,node.key);
                    }
                }
                if ((payloadType === 'object') && (propertyKey === null || propertyKey === undefined || propertyKey === "")) {
                    if (node.mode === "auto") {
                        node.warn("Message missing 'msg.parts.key' property - cannot add to object");
                    } else {
                        node.warn("Message missing key property 'msg."+node.key+"' - cannot add to object")
                    }
                    return;
                }
                if (!inflight.hasOwnProperty(partId)) {
                    if (payloadType === 'object' || payloadType === 'merged') {
                        inflight[partId] = {
                            currentCount:0,
                            payload:{},
                            targetCount:targetCount,
                            type:"object",
                            msg:msg
                        };
                    }
                    else if (node.accumulate === true) {
                        if (msg.hasOwnProperty("reset")) { delete inflight[partId]; }
                        inflight[partId] = inflight[partId] || {
                            currentCount:0,
                            payload:{},
                            targetCount:targetCount,
                            type:payloadType,
                            msg:msg
                        }
                        if (payloadType === 'string') {
                            inflight[partId].payload = [];
                        }
                    }
                    else {
                        inflight[partId] = {
                            currentCount:0,
                            payload:[],
                            targetCount:targetCount,
                            type:payloadType,
                            msg:msg
                        };
                        if (payloadType === 'string') {
                            inflight[partId].joinChar = joinChar;
                        } else if (payloadType === 'array') {
                            inflight[partId].arrayLen = arrayLen;
                        } else if (payloadType === 'buffer') {
                            inflight[partId].bufferLen = 0;
                        }
                    }
                    if (node.timer > 0) {
                        inflight[partId].timeout = setTimeout(function() {
                            completeSend(partId)
                        }, node.timer)
                    }
                }

                var group = inflight[partId];
                if (payloadType === 'buffer') {
                    inflight[partId].bufferLen += property.length;
                }
                if (payloadType === 'object') {
                    group.payload[propertyKey] = property;
                    group.currentCount = Object.keys(group.payload).length;
                    //msg.topic = node.topic || msg.topic;
                } else if (payloadType === 'merged') {
                    if (Array.isArray(property) || typeof property !== 'object') {
                        if (!msg.hasOwnProperty("complete")) {
                            node.warn("Cannot merge non-object types");
                        }
                    } else {
                        for (propertyKey in property) {
                            if (property.hasOwnProperty(propertyKey)) {
                                group.payload[propertyKey] = property[propertyKey];
                            }
                        }
                        group.currentCount = Object.keys(group.payload).length;
                        //group.currentCount++;
                    }
                } else {
                    if (!isNaN(propertyIndex)) {
                        group.payload[propertyIndex] = property;
                    } else {
                        group.payload.push(property);
                    }
                    group.currentCount++;
                }
                // TODO: currently reuse the last received - add option to pick first received
                group.msg = msg;
                var tcnt = group.targetCount;
                if (msg.hasOwnProperty("parts")) { tcnt = group.targetCount || msg.parts.count; }
                if (group.currentCount >= tcnt || msg.hasOwnProperty('complete')) {
                    completeSend(partId);
                }
            } catch(err) {
                console.log(err.stack);
            }
        });

        this.on("close", function() {
            for (var i in inflight) {
                if (inflight.hasOwnProperty(i)) {
                    clearTimeout(inflight[i].timeout);
                }
            }
        });
    }
    RED.nodes.registerType("join",JoinNode);
}
