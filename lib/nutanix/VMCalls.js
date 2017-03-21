'use strict'

var debug = require('debug')('VMCalls');

var request = require('request').defaults({
  strictSSL: false,
  rejectUnauthorized: false
});

var APICalls = require('./apiCalls.js');

var nconf = require("nconf");

var auth = "Basic " + new Buffer(nconf.get('nutanixUser') + ':' + nconf.get('nutanixPass')).toString('base64');

var VMCalls = {};


VMCalls.createVM = function (vmId, user, cb) {
  // look for VM first, if not found create one
  VMCalls.findVM(vmId, function (fErr, rMeta) {
    // already exists
    if (rMeta) {
      return cb(null, rMeta.uuid);
    }

    //create VM
    var json = VMCalls.createVMPost(vmId, nconf.get('vmDiskId'), nconf.get('networkPublicVlanUuid'), user);
    debug("nutanix vm request", json);
    APICalls.prism.post('/PrismGateway/services/rest/v1/vms', json, function (err, resp, body) {
      if (err) {
        return cb(err);
      }
      // should get a taskId back.
      debug('resp from vm create:');
      debug(resp.statusCode);
      debug(body);
      // start short wait for the VM to register
      VMCalls.listenForVM(json.name, 5, function (err, uuid) {
        if (err) {
          return cb(err);
        }

        VMCalls.startVM(uuid, function (er, u) {
          if (er) {
            return cb(err);
          }
          return cb(null, u);
        });
      });
    });
  });
}



// returns the uuid of the VM
VMCalls.createVMOLD = function (vmId, callback) {
  var api = nconf.get('nutanixAPI') + '/PrismGateway/services/rest/v1/vms';
  var networkUuid = nconf.get('networkPublicVlanUuid');

  var json = VMCalls.createVMPost(vmId, nconf.get('vmDiskId'), networkUuid);
  debug("nutanix vm request", json);
  request({
    url: api,
    method: 'post',
    json: true,
    body: json,
    headers: {
      "Authorization": auth
    }

  }, function (err, resp, body) {
    //TODO: error
    // should get a taskId back.
    debug('resp from vm create:', resp.statusCode);
    debug(body);
    VMCalls.listenForVM(json.name, 0, function (err, uuid) {

      VMCalls.startVM(uuid, function (er, u) {
        if (er) {
          callback(err);
          return;
        }
        callback(null, u);
        return;
      });
    });
  });
}

// find the VM and start it, then return VM uuid
VMCalls.startVM = function (uuid, cb) {
  debug('starting vm: ', uuid);
  APICalls.ach.post('vms/' + uuid + '/set_power_state', {
      transition: 'on'
    },
    function (err, resp, body) {
      if (err) {
        debug('failed to start', err);
        return cb(err);
      }
      debug("startVM response code: " + resp.statusCode);
      if (resp.statusCode != 200) {
        return cb(new Error('bad response from nutanix starting VM: ' + uuid + ' code: ' + resp.statusCode));
      }
      debug('start vm body', body);
      // got it
      if (body['taskUuid'] != null) {
        debug('started VM uuid: ' + uuid);
        return cb(null, uuid);
      } else {
        debug('unable to start VM');
        return cb(new Error('Unable to start VM'));
      }
    });
}

VMCalls.getAllVM = function (cb) {
  APICalls.prism.get('/PrismGateway/services/rest/v1/vms/', function (err, resp, body) {
    if (err) {
      return cb(err);
    }
    // got it
    if (body.metadata.count >= 1) {
      debug('found VMs', body.metadata.count);
      return cb(null, body.entities);
    } else {
      return cb(null);
    }
  });
}

// deletes a vm
VMCalls.deleteVM = function (vmId, cb) {
  APICalls.ach.del('/vms/' + vmId, function (err, resp, body) {
    if (err) {
      return cb(err);
    }
    return cb(null, resp.taskUuid);
  });
}

VMCalls.findVM = function (vmId, cb) {
  APICalls.prism.get('/PrismGateway/services/rest/v1/vms/?searchString=' + vmId, function (err, resp, body) {
    if (err) {
      return cb(err);
    }
    // got it
    if (body.metadata.count == 1) {
      debug('found VM', vmId, 'uuid', body.entities[0].uuid);
      return cb(null, body.entities[0]);
    } else if (body.metadata.count > 1) {
      return cb(new Error('Found more than 1 VM!'));
    } else {
      return cb(null);
    }
  });
}


// polls looking for the VM to show up
VMCalls.listenForVM = function (vmId, attempt, cb) {
  debug('listen', vmId, attempt);
  // TODO: param check
  attempt -= 1;
  // recursion break
  if (attempt == 0) {
    return cb(new Error('Attempts exceeded listening for VM ' + vmId));
  }

  VMCalls.findVM(vmId, function (err, VMMeta) {
    if (err) {
      return cb(err);
    } else {
      // did we find it?
      if (VMMeta) {
        return cb(null, VMMeta.uuid);
      } else {
        // otherwise try again
        debug('did not find VM: ' + vmId);
        setTimeout(function () {
          VMCalls.listenForVM(vmId, attempt, cb)
        }, 3000);
      }
    }
  });
}

// returns a post object for creating a new VM vm
VMCalls.createVMPost = function (vmId, vmDiskId, networkUuid, desc) {

  return {
    "name": 'guest-VM-' + vmId,
    "memoryMb": 1024,
    "numVcpus": 2,
    "description": desc,
    "numCoresPerVcpu": 1,
    "vmDisks": [{
      "vmDiskClone": {
        "minimumSize": 21474836480,
        "vmDiskUuid": vmDiskId
      },
      "isEmpty": false,
      "isCdrom": false,
      "diskAddress": {
        "deviceBus": "ide"
      }
    }],
    "vmNics": [{
      "networkUuid": networkUuid
    }]
  }

  var other = {
    "name": "cloud1",
    "memoryMb": 2048,
    "numVcpus": 2,
    "description": "cloud1",
    "numCoresPerVcpu": 1,
    "vmDisks": [{
      "vmDiskClone": {
        "minimumSize": 21474836480,
        "vmDiskUuid": "f1483439-9e83-4d00-ac80-5750870e43fa"
      },
      "isEmpty": false,
      "isCdrom": false,
      "diskAddress": {
        "deviceBus": "pci"
      }
    }],
    "vmNics": [{
      "networkUuid": "f10956ca-1f01-4a48-839e-867c0851ee47"
    }],
    "vmCustomizationConfig": {
      "userdata": "write_files:\n-   content: |\n        # testing\n\n        test\n    path: /etc/test\n    permissions: '0644'\n    owner: root:root",
      "filesToInjectList": []
    }
  }


};

module.exports = VMCalls;