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

var should = require("should");
var path = require('path');
var fs = require('fs-extra');

var tailNode = require("../../../../nodes/core/storage/28-tail.js");
var helper = require("../../helper.js");

describe('TailNode', function() {
    
    var tempDir = path.join(__dirname, ".tmp/");
    var fileToTail = path.join(tempDir, "tailMe.txt");

    beforeEach(function(done) {
        fs.exists(fileToTail, function(exists) {
            if(exists) {
                fs.unlinkSync(fileToTail);
            } 
        });
        fs.exists(tempDir, function(exists) {
            if(!exists) {
                fs.mkdirSync(tempDir);
            }
            fs.writeFileSync(fileToTail, "Tail message line1\nTail message line2\n");
            helper.startServer(done);
        });
    });
    
    afterEach(function(done) {
        helper.unload();
        fs.exists(fileToTail, function(exists) {
            if(exists) {
                fs.unlinkSync(fileToTail);
            } 
            // have to call stop server otherwise tail node litters test output
            // with warnings when tailed file gets deleted
            fs.remove(tempDir, helper.stopServer(done));
          });
    });

    it('should be loaded', function(done) {
        var flow = [{id:"tailNode1", type:"tail", name: "tailNode", "split":true, "filename":fileToTail}];
        helper.load(tailNode, flow, function() {
            var tailNode1 = helper.getNode("tailNode1");
            tailNode1.should.have.property('name', 'tailNode');
            done();
        });
    });
    
    it('should tail a file', function(done) {
        var flow = [{id:"tailNode1", type:"tail", name: "tailNode", "split":true, "filename":fileToTail, "wires":[["helperNode1"]]},
                    {id:"helperNode1", type:"helper", wires:[]}];
        helper.load(tailNode, flow, function() {
            var tailNode1 = helper.getNode("tailNode1");
            var helperNode1 = helper.getNode("helperNode1");
            var inputCounter = 0;
            helperNode1.on("input", function(msg) {
                msg.should.have.property('topic', fileToTail);
                msg.payload.should.equal("Tail message line" + (++inputCounter));
            });
            done();
        });
    });
    
    it('work in non-split mode', function(done) {
        var flow = [{id:"tailNode1", type:"tail", name: "tailNode", "split":false, "filename":fileToTail, "wires":[["helperNode1"]]},
                    {id:"helperNode1", type:"helper", wires:[]}];
        helper.load(tailNode, flow, function() {
            var tailNode1 = helper.getNode("tailNode1");
            var helperNode1 = helper.getNode("helperNode1");
            helperNode1.on("input", function(msg) {
                msg.should.have.property('topic', fileToTail);
                msg.payload.should.equal("Tail message line1\nTail message line2\n");
            });
            done();
        });
    });
});
