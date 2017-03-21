process.env.DEBUG = "*,-express:*,-body-parser:*";

var debug = require('debug')('server');

// setup properties/conf
var nconf = require('nconf');

// to create an image:
// log into cvm:
// acli
// image.create <img-name> clone_from_vmdisk=vm:<vm name>:dev:inst
// eg: image.create new-image clone_from_vmdisk=vm:server:scsi:0

// image.get <img.name> will get vmdisk_uuid to use in vmDiskId

// net.list will get network uuid

// generate a cert
// openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 -keyout server.key -out server.crt
// or openssl req -subj ‘/CN=domain.com/O=My Company Name LTD./C=US’ -new -newkey rsa:2048 -days 365 -nodes -x509 -keyout server.key -out server.crt

nconf.overrides({
  'port': 8443,
  'nutanixAPI': 'https://192.168.1.95:9440',
  'nutanixUser': 'ntx',
  'nutanixPass': 'ntxntxntx',
  'achAPI': 'https://192.168.1.95:9440/api/nutanix/v0.8/',
  'vmDiskId': 'f1483439-9e83-4d00-ac80-5750870e43fa',
  'networkPublicVlanUuid': 'f10956ca-1f01-4a48-839e-867c0851ee47',
  'dataImageUUID': '',
  'uiImageID': '',
  'userFileLocation': './user',
  'secure': false
});

nconf.env().argv();

var crypto = require('crypto');

var express = require('express');

var fs = require('fs');
var path = require('path');
var https = require('https');
var clientCertificateAuth = require('client-certificate-auth');

// cert setup
var opts = {
  // Server SSL private key and certificate 
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  // issuer/CA certificate against which the client certificate will be 
  // validated. A certificate that is not signed by a provided CA will be 
  // rejected at the protocol layer. 
  ca: fs.readFileSync('server.crt'),
  // request a certificate, but don't necessarily reject connections from 
  // clients providing an untrusted or no certificate. This lets us protect only 
  // certain routes, or send a helpful error message to unauthenticated clients. 
  requestCert: true,
  rejectUnauthorized: false
};

// setup middleware
var app = express();

// wrapper to enable/disable cert middleware
var doAuth = function () {
  if (nconf.get('secure')) {
    return clientCertificateAuth(checkAuth);
  } else {
    return function (req, res, next) {
      return next();
    }
  }
}

// add security to middleware
//app.use(clientCertificateAuth(checkAuth));
app.use(doAuth());

var bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// static content
var localDir = path.join(__dirname, 'static');
debug('local dir', localDir);

app.use('/', express.static(localDir));
//app.use('/static/', express.static(path.join(__dirname, 'node_modules')));


// load our user cn
var user = fs.readFileSync(nconf.get('userFileLocation'));
debug('allowed user', user);
// TODO: fail if didnt work

// our security check
var checkAuth = function (cert) {
  return cert.subject.CN === user;
};

var VMCalls = require('./lib/nutanix/VMCalls.js');

// request param
app.param('vmId', function (req, res, next, vmId) {
  console.log("vm param called: " + vmId);
  req.vmId = vmId;
  next();
});


//vm stuffs

// gets us the vmid by hashing the users CN
var getVmId = function (req, cb) {
  var cert = {};
  if (nconf.get('secure')) {
    cert = req.connection.getPeerCertificate();
  } else {
    cert = {
      subject: {
        CN: 'test'
      }
    }
  }

  var vmId = crypto.createHash('md5').update(cert.subject.CN).digest('hex');
  debug('new vmId: ' + vmId);
  return cb(null, {
    vmId: vmId,
    user: cert.subject.CN
  });
}

app.get('/whoami', function (req, res) {
  getVmId(req, function (err, key) {
    if (err) {
      res.status(400).send(err);
    } else {
      res.send(key.user);
    }
  })
});

// get all vm info
app.get('/vms/', doAuth(), function (req, res) {
  VMCalls.getAllVMs(function (err, vms) {
    if (err) {
      return res.status(400).send(err);
    } else {
      return res.send(vms);
    }
  });
});

// another way to plug a downstream server with its DN
// if the IP requesting matches one that we want, send it
app.get('/myUser/', function (req, res) {
  debug(req.connection.remoteAddress);
  var ip = req.connection.remoteAddress;
  VMCalls.getAllVMs(function (err, vms) {
    if (err) {
      return res.status(400).send(err);
    } else {

      var dn = "";
      vms.forEach(function (vm, i, a) {
        if (vm.ipAddresses.length == 1) {
          if (vm.ipAddresses[0] == ip) {
            //            dn =
          }
        }
      });

      return res.send(vms);
    }
  });

  return res.send('ok');
});

app.delete('/vm/', doAuth(), function (req, res) {
  getVmId(req, function (e, key) {
    VMCalls.findVM(key.vmId, function (err, meta) {
      if (err) {
        return res.status(400).send(err);
      } else {
        if (meta) {
          VMCalls.deleteVM(meta.uuid, function (derr, task) {
            if (derr) {
              return res.status(400).send(derr);
            } else {
              return res.send(task);
            }
          });
        } else {
          return res.status(400).send('no vm available');
        }
      }
    })
  });
});

// find the vm (bad rest I know!!)
app.get('/vm/', doAuth(), function (req, res) {
  getVmId(req, function (e, key) {
    VMCalls.findVM(key.vmId, function (err, meta) {
      if (err) {
        return res.status(400).send(err);
      } else {
        if (meta) {
          return res.send(meta);
        } else {
          return res.status(400).send('no vm available');
        }
      }
    })
  });
});

// get info on vm
app.get('/vm/:vmId', doAuth(), function (req, res) {
  getVmId(req, function (e, key) {
    VMCalls.findVM(key.vmId, function (err, meta) {
      if (err) {
        return res.status(400).send(err);
      } else {
        return res.send(meta);
      }
    })
  });

});

// create a vm
app.post('/vm/', doAuth(), function (req, res) {
  getVmId(req, function (e, key) {
    debug('new vmId: ' + key.vmId);
    //TODO: check exists

    VMCalls.createVM(key.vmId, key.user, function (err, uuid) {
      if (err)
        return res.status(400).send('badness ' + err);
      else {
        return res.send(uuid);
      }
    });
  });
});


// unsecure test uri
app.get('/', function (req, res) {
  console.log('########## YAY!!!');
  res.send("HELLO!");
})

//app.listen(nconf.get('port'), function () {
//  console.log("up on " + nconf.get('port'));
//});


https.createServer(opts, app).listen(nconf.get('port'));