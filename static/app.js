// create our angular app and inject ui.bootstrap
//angular.module('myApp', ['ui.bootstrap'])


angular.module('myApp', [])

.controller('mainController', function ($scope, $http) {


  $scope.vm = {
    ready: false,
    tries: 0

  };

  $scope.user = "";

  $scope.disableButton = false;

  $scope.errors = [];

  // form submission
  $scope.submit = function () {
    $scope.disableButton = true;
    $http({
      method: 'POST',
      url: 'vm/'
    }).then(function successCallback(res) {
      console.log(res);
      findUri();
    }, function errorCallback(res) {
      $scope.errors.push({
        msg: 'error creating vm',
        err: res
      });

      setTimeout(function () {
        $scope.errors.pop();
      }, 5000);

      $scope.disableButton = false;
    });
  };


  // form submission for delete
  $scope.destroy = function () {
    console.log('destroying');
    $scope.disableButton = true;
    $http({
      method: 'DELETE',
      url: 'vm/'
    }).then(function successCallback(res) {
      console.log(res);
      // reset ui
      setTimeout(function () {
        $scope.vm.ready = false;
        $scope.disableButton = false;
      }, 2000);
    }, function errorCallback(res) {
      $scope.errors.push({
        msg: 'error creating vm',
        err: res
      });

      setTimeout(function () {
        $scope.errors.pop();
      }, 5000);

      $scope.disableButton = false;
    });
  };

  // one time see if a vm already exists
  $http({
    method: 'GET',
    url: 'vm/'
  }).then(function successCallback(res) {
    console.log(res);
    if (res.data && res.data.ipAddresses.length == 1) {
      // got it
      $scope.vm.uri = 'https://' + res.data.ipAddresses[0] + ':8443';
      $scope.vm.ready = true;
    }
  }, function errorCallback(res) {
    console.log('no vm looks like ' + res);
  });


  // timeout attempts to go find a vm
  findUri = function () {
    console.log('finduri called');
    $scope.vm.tries++;

    $http({
      method: 'GET',
      url: 'vm/'
    }).then(function successCallback(res) {
      console.log(res);
      if (res.data && res.data.ipAddresses.length == 1) {
        // got it
        $scope.vm.uri = 'https://' + res.data.ipAddresses[0] + ':8443';
        $scope.vm.ready = true;
        $scope.disableButton = true;
      } else {
        setTimeout(function () {
          findUri();
        }, 3000);
      }
    }, function errorCallback(res) {
      $scope.errors.push({
        msg: 'error creating vm',
        err: res
      });

      setTimeout(function () {
        $scope.errors.pop();
      }, 5000);
    });
  }

  // get user name
  $http({
    method: 'GET',
    url: 'whoami'
  }).then(function successCallback(res) {
    console.log(res);
    $scope.user = res.data;
  }, function errorCallback(res) {
    $scope.errors.push({
      msg: 'error creating vm',
      err: res
    });

    setTimeout(function () {
      $scope.errors.pop();
    }, 5000);
  });

});