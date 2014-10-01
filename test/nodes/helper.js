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
var when = require("when");
var request = require('supertest');
var nock;
if (!process.version.match(/^v0\.[0-9]\./)) {
    // only set nock for node >= 0.10
    nock = require('nock');
}
var RED = require("../../red/red.js");
var redNodes = require("../../red/nodes");
var flows = require("../../red/nodes/flows");
var credentials = require("../../red/nodes/credentials");
var comms = require("../../red/comms.js");

var http = require('http');
var express = require('express');
var app = express();

var address = '127.0.0.1';
var listenPort = 0; // use ephemeral port
var port;
var url;

var server;

function helperNode(n) {
    RED.nodes.createNode(this, n);
}

module.exports = {
    load: function(testNode, testFlows, testCredentials, cb) {
        if (typeof testCredentials === 'function') {
            cb = testCredentials;
            testCredentials = {};
        }

        var storage = {
            getFlows: function() {
                var defer = when.defer();
                defer.resolve(testFlows);
                return defer.promise;
            },
            getCredentials: function() {
                var defer = when.defer();
                defer.resolve(testCredentials);
                return defer.promise;
            },
            saveCredentials: function() {
                // do nothing
            },
        };
        var settings = {
            available: function() { return false; }
        };

        redNodes.init(settings, storage);
        credentials.init(storage);
        RED.nodes.registerType("helper", helperNode);
        testNode(RED);
        flows.load().then(function() {
            should.deepEqual(testFlows, flows.getFlows());
            cb();
        });
    },
    unload: function() {
        // TODO: any other state to remove between tests?
        redNodes.clearRegistry();
        return flows.stopFlows();
    },

    getNode: function(id) {
        return flows.get(id);
    },

    credentials: credentials,

    clearFlows: function() {
        return flows.clear();
    },

    request: function() {
        return request(RED.httpAdmin);
    },

    startServer: function(done) {
        server = http.createServer(function(req,res){app(req,res);});
        RED.init(server, {});
        server.listen(listenPort, address);
        server.on('listening', function() {
            port = server.address().port;
            url = 'http://' + address + ':' + port;
            comms.start();
            done();
        });
    },
    //TODO consider saving TCP handshake/server reinit on start/stop/start sequences
    stopServer: function(done) {
        if(server) {
            server.close(done);
        }
    },

    url: function() { return url; },

    nock: nock,

};
