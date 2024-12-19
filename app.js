var app = angular.module('GraveApp', ['ngAnimate', 'mgcrea.ngStrap']);

app.config(['$asideProvider', function($asideProvider) {
    angular.extend($asideProvider.defaults, {
      container: 'body',
      backdrop: false,
      animation: 'am-fade-and-slide-right'
    });
  }
]);

app.controller('MapCtrl', ['$scope', '$http', '$aside', '$alert', '$modal', function($scope, $http, $aside, $alert, $modal) {

    $scope.busy = false;
    $scope.static = {
      'api': "https://overpass-api.de/api/interpreter?data=",
      'background': "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    };

    $scope.map;
    $scope.graves = {
      layer: new L.LayerGroup(),
      data: {}
    };
    $scope.active = {};

    var aside = $aside({
      content: '',
      template: "templates/sidebar.html",
      scope: $scope,
      show: false
    });
    aside.isOpen = function() {
      return document.querySelector(".aside") === null ? false : true;
    };
    var modal = $modal({
      content: '',
      template: "templates/search.html",
      scope: $scope,
      show: false
    });

    /**
     * Init map
     * @returns {void}
     */
 $scope.initMap = function() {
  $scope.map = L.map('map', {
    center: [52, 19.5],
    zoom: 6,
    layers: [new L.tileLayer($scope.static.background, {
      attributionControl: false,
      maxZoom: 23,
      maxNativeZoom: 19,
      opacity: 0.8
    }), $scope.graves.layer]
  });
  new L.Hash($scope.map);
  $scope.map.attributionControl.setPrefix('');
};
$scope.initMap();

$scope.search = function() {
  $scope.busy = true;
  $http({
    method: 'GET',
    url: 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent($scope.searchText) + '&format=json'
  }).then(function(response) {
    $scope.busy = false;
    const data = response.data;
    console.log(data);
    if (data.length > 0) {
      const item = data[0];
      $scope.map.setView([item.lat, item.lon], 13);
    }
  }).catch(function(error) {
    $scope.busy = false;
    alert('Error: ' + error.data);
  });
};

$scope.searchGraves = function() {
  const searchName = $('#searchName').val();
  if (searchName) {
    $scope.loadDataAdv(searchName);
  } else {
    alert('Please enter a name to search.');
  }
};

$scope.loadDataPopup = function() {
  modal.show();
};

$scope.loadData = function() {
  const b = $scope.map.getBounds();
  const bbox = `(${b.getSouthEast().lat},${b.getNorthWest().lng},${b.getNorthWest().lat},${b.getSouthEast().lng})`;

  $scope.busy = true;
  $http({
    method: 'GET',
    url: $scope.static.api + encodeURIComponent(`[out:json];relation["type"="person"]${bbox};>>;out;`)
  }).then(function(response) {
    $scope.busy = false;
    $scope.parseData(response.data.elements);
  }).catch(function(error) {
    $scope.busy = false;
    alert('Error: ' + error.data);
  });
};

$scope.loadDataAdv = function(name) {
  const b = $scope.map.getBounds();
  const bbox = `(${b.getSouthEast().lat},${b.getNorthWest().lng},${b.getNorthWest().lat},${b.getSouthEast().lng})`;
  const query = `[out:json];(rel[name~"${name}",i][type="person"]${bbox};rel[family_name~"${name}",i][type="person"]${bbox};);>>;out;`;
  
  console.log(query);
  $scope.busy = true;
  $http({
    method: 'GET',
    url: $scope.static.api + encodeURIComponent(query)
  }).then(function(response) {
    $scope.busy = false;
    $scope.parseData(response.data.elements);
  }).catch(function(error) {
    $scope.busy = false;
    alert('Error: ' + error.data);
  });
};

$scope.parseData = function(data) {
  const graves = {};

  data.forEach(item => {
    if (item.type === 'node') {
      graves[item.id] = {
        id: item.id,
        type: 'node',
        latlng: [item.lat, item.lon],
        tags: item.tags,
        people: []
      };
    } else if (item.type === 'way') {
      const latlngs = item.nodes.map(k => graves[k].latlng);
      graves[item.id] = {
        id: item.id,
        type: 'way',
        latlngs: latlngs,
        tags: item.tags,
        people: []
      };
    }
  });

  data.forEach(item => {
    if (item.type === 'relation') {
      const person = {
        id: item.id,
        name: item.tags.name,
        tags: item.tags
      };
      item.members.forEach(member => {
        if (member.role === 'tomb') {
          graves[member.ref].people.push(person);
        }
      });
    }
  });

  $scope.graves.data = graves;
  $scope.graves.layer.clearLayers();
  Object.values(graves).forEach(grave => {
    if (grave.tags) $scope.drawGrave(grave.id);
  });
};

    /////////////////////////////////////////////////////////////////////////////////// DRAWING ////
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Opening active building
     * @returns {void}
     */
    $scope.openGrave = function() {
      if (!aside.isOpen())
        aside.show();
    };

    /**
     * Closing acrive building
     * @returns {void}
     */
    $scope.closeGrave = function() {
    };

    /**
     * Drawing building outline/shell
     * @param {Integer} id building relation ID
     * @returns {void}
     */
    $scope.drawGrave = function(id) {

      if ($scope.graves.data[id] === 'undefined') {
        alert('No building with ID: ' + id);
        return false;
      }

      var grave = $scope.graves.data[id];
      if (grave.type === "node") {
        var marker = L.marker(grave.latlng, {})
                .on('click', function() {
                  $scope.active = $scope.graves.data[id];
                  $scope.openGrave();
                  $scope.$apply();
                  console.log($scope.active);
                })
                .addTo($scope.graves.layer);
                console.log(marker);
        if ($scope.graves.data[id].tags.name)
          marker.bindTooltip($scope.graves.data[id].tags.name, {className: "tooltip", offset: [0, 0] });
      }
      else if (grave.type === "way") {
        var polygon = L.polygon(grave.latlngs, {})
                .on('click', function() {
                  $scope.active = $scope.graves.data[id];
                  $scope.openGrave();
                  $scope.$apply();
                  console.log($scope.active);
                })
                .addTo($scope.graves.layer);
      }
    };
  }]);

