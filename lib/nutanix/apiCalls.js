'use scrict'

// wrapper around configuration to make nutanix rest api calls


var request = require('request').defaults({
  strictSSL: false,
  rejectUnauthorized: false
});

// load our conf
// TODO: move to storage somewhere and reload once in a while
var nconf = require("nconf");

var auth = "Basic " + new Buffer(nconf.get('nutanixUser') + ':' + nconf.get('nutanixPass')).toString('base64');

APICalls = {
  ach: {},
  prism: {}
};

// Get request acropolis api's
APICalls.ach.get = function (uriPath, cb) {
  var api = nconf.get('achAPI') + uriPath;
  getR(api, cb);
}

// DELETE request acropolis api's
APICalls.ach.del = function (uriPath, cb) {
  var api = nconf.get('achAPI') + uriPath;
  delR(api, cb);
}

APICalls.ach.post = function (uriPath, jsonBody, cb) {
  var api = nconf.get('achAPI') + uriPath;
  getP(api, jsonBody, cb);
}

// Get request acropolis api's
APICalls.prism.get = function (uriPath, cb) {
  var api = nconf.get('nutanixAPI') + uriPath;
  getR(api, cb);
}

APICalls.prism.post = function (uriPath, jsonBody, cb) {
  var api = nconf.get('nutanixAPI') + uriPath;
  getP(api, jsonBody, cb);
}

// canned get request with auth
var getR = function (url, cb) {
  request({
    url: url,
    json: true,
    method: 'get',
    headers: {
      "Authorization": auth
    }
  }, cb);
}

// canned get request with auth
var delR = function (url, cb) {
  request({
    url: url,
    json: true,
    method: 'delete',
    headers: {
      "Authorization": auth
    }
  }, cb);
}


var getP = function (url, jsonBody, cb) {
  request({
    url: url,
    method: 'post',
    json: true,
    body: jsonBody,
    headers: {
      "Authorization": auth
    }
  }, cb);
}



module.exports = APICalls;