// Looping and creating buttons to search for data items

$(document).ready(function () {
  let dataitems = [
    "hospitals",
    "educationals",
    "waterbodies",
    "roads",
    "electricity",
    "forests",
    "elevations",
  ];
  //checkboxes click logic
  let DATA_LAYERS = {};
  let lat = 23.5937;
  let lng = 78.9629;
  let radius = 0;
  var line;
  let c = L.circle([0, 0], 3); //just a fake initial circle
  var marker_layer_arr = [];
  $("#distance-btn").hide();
  $("#shortestpath").hide();
  $("#markerform").hide();
  dataitems.forEach((i) => {
    var item = `<div class="databox m-1"><input type="checkbox" class="mx-1" name="${i}" id="${i}" value="${i}"></input><label for="${i}">${i}</label></div>`;
    $("#checkboxgroup").append(item);
  });

  // loader animation squares
  $("#spinner").hide();
  $(document)
    .ajaxStart(function () {
      $("#spinner").show();
    })
    .ajaxStop(function () {
      $("#spinner").hide();
    });

  //action on shortest path button click
  $("#shortestpath").click(function () {
    if (line) {
      find_shortest_Path();
    } else {
      alert("Please draw a line or path first.");
    }
  });
  //action on calculate distance button press

  $("#distance-btn").click(function (e) {
    if (line) {
      var featurecollection = [];
      if (DATA_LAYERS["waterbodies"]) {
        featurecollection.push(DATA_LAYERS["waterbodies"]);
      }
      if (DATA_LAYERS["forests"]) {
        featurecollection.push(DATA_LAYERS["forests"]);
      }
      var fcPoly = L.featureGroup(featurecollection);
      fcPoly = fcPoly.toGeoJSON();

      LineSectionsOnPolygon(line, fcPoly);
    } else {
      alert("Please first draw a line on map.");
    }
  });
  //action on form submission
  $("#myform").submit(function (event) {
    event.preventDefault();
    lat = $('#myform>div>input[name="lat"]').val();
    lng = $('#myform>div>input[name="lng"]').val();
    radius = String(Number($('#myform>div>input[name="radius"]').val()) * 1000);

    for (var l in DATA_LAYERS) {
      console.log(l);
    }

    if (c) {
      c.remove();
    }
    try {
      c = L.circle([lat, lng], { radius: radius, fillOpacity: 0.05 }).addTo(
        map
      );
      map.setView([lat, lng], 11);
    } catch (e) {
      alert(
        "Please enter coordintes in correct form. They can only be number."
      );
      console.log(e);
    }
    $("#submit-button").attr("class", "btn btn-success");
  });

  //input boxes changes event
  $('.databox input[type="checkbox"]').change(async function (event) {
    const data_type = this.value;
    if (radius == 0) {
      alert("Please Fill the Coordinates in form.");
      $(`.databox>input[name="${data_type}"]`).prop("checked", false);
      return null;
    }
    if (this.checked) {
      DATA_LAYERS[data_type] = await add_the_data_layer(data_type);
      layer = DATA_LAYERS[data_type];

      try {
        map.fitBounds(layer.getBounds());
      } catch (e) {
        console.log(e);
        alert("no data layer found.");
      }
    } else {
      layer = DATA_LAYERS[data_type];
      layer.remove();
    }
  });

  //setting up the map#############################################################################################################################

  var osmUrl = "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    osmAttrib =
      '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    osm = L.tileLayer(osmUrl, { attribution: osmAttrib }),
    map = new L.Map("map", {
      center: new L.LatLng(21.1458, 79.0882),
      zoom: 5,
    }),
    drawnItems = L.featureGroup().addTo(map);
  L.control
    .layers(
      {
        osm: osm.addTo(map),
        google: L.tileLayer(
          "http://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}",
          {
            attribution: "google",
          }
        ),
      },
      { drawlayer: drawnItems },
      { position: "topleft", collapsed: false }
    )
    .addTo(map);
  map.addControl(
    new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
        poly: {
          allowIntersection: false,
        },
      },
      draw: {
        polygon: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: true,
        polyline: {
          shapeOptions: {
            color: "red",
            opacity: 0.7,
          },
        },
      },
    })
  );

  //drawing on the map
  map.on(L.Draw.Event.CREATED, function (event) {
    var drawn_layer = event.layer;
    //when drawn a marker
    if (event.layerType === "marker") {
      var marker_geojson = drawn_layer.toGeoJSON();
      $("#markerform").show();
      $("#markerform").submit(function (event) {
        event.preventDefault();
        $("#markerform").hide();
        marker_geojson.properties.buffer_radius = $("#markerradius").val();
        marker_geojson.properties.markername = $("#markername").val();
        console.log(marker_geojson);
        var marker_layer = L.geoJson(marker_geojson)
          .bindPopup(
            `Name:${marker_geojson.properties.markername}
                     Radius:${marker_geojson.properties.buffer_radius}`
          )
          .addTo(map);
        $("#shortestpath").show();
        marker_layer_arr.push({ ...marker_geojson });
      });
    } else if (event.layerType === "polyline") {
      //to diaplay the green distance calulation button
      $("#distance-btn").show();
      drawnItems.addLayer(drawn_layer);
      line = drawn_layer.toGeoJSON();
      console.log(line);
    } else {
      alert(
        "this type of drawing type(feature) not suported.Please edit javascript code."
      );
    }
  });

  //function to find shortest path without colliding obstacles
  function find_shortest_Path() {
    console.log(marker_layer_arr);
    var obstacles_arr = marker_layer_arr.map(function (layer) {
      let g = layer.toGeoJSON();
      console.log(g);
      return turf.buffer(g, Number(g.properties.buffer_radius), {
        units: "meters",
      });
    });

    obstacles_arr = obstacles_arr.map(function (element) {
      return L.geoJson(element);
    });
    // console.log(obstacles_arr);
    var obstacles = L.featureGroup(obstacles_arr).toGeoJSON();
    // var obstacles = turf.buffer(lgroup, buffer_radius, {
    //   units: "meters",
    // });
    // console.log("obstacles array", obstacles);

    L.geoJson(obstacles, {
      style: function (f) {
        return { color: "pink" };
      },
      onEachFeature: function (f, l) {
        l.bindPopup(`obstacle area radius:${f.properties.buffer_radius}`);
      },
    }).addTo(map);

    var startPoint = line.geometry.coordinates[0];
    var endPoint =
      line.geometry.coordinates[line.geometry.coordinates.length - 1];
    var options = { obstacles: obstacles };
    var shortest_path = turf.shortestPath(startPoint, endPoint, options);
    // var spline_curved_path = turf.bezierSpline(shortest_path);
    var blackpath = L.geoJson(shortest_path, {
      style: function (feature) {
        return { color: "#f7c63e", weight: 3 };
      },
    }).bindPopup("shortest path without colliding obstacles");
    drawnItems.addLayer(blackpath);
    // var cyanpath = L.geoJson(spline_curved_path, {
    //   style: function (feature) {
    //     return { color: "cyan", weight: 3 };
    //   },
    // }).bindPopup("Curved Path");
    // drawnItems.addLayer(cyanpath);
  }

  // geospatial analysing the distance and slices of lines on the waterbodies and forests
  function LineSectionsOnPolygon(line, fcPoly) {
    var total_distance = turf.length(line);
    var distance_on_waterforest = 0;

    var fgp = [];
    var bbline = turf.bboxPolygon(turf.bbox(line));
    for (var i = 0; i < fcPoly.features.length; i++) {
      var bb = turf.bboxPolygon(turf.bbox(fcPoly.features[i]));
      if (turf.intersect(bbline, bb)) {
        var slc = turf.lineSplit(line, fcPoly.features[i]);
        for (var j = 0; j < slc.features.length; j++) {
          var curSlc = slc.features[j];
          var len = turf.length(curSlc, { units: "kilometers" });
          var ptMiddle = turf.centroid(curSlc);
          if (turf.booleanWithin(ptMiddle, fcPoly.features[i])) {
            curSlc.properties = fcPoly.features[i];

            var newlayer = L.geoJson(curSlc, {
              style: function (feature) {
                return { color: "yellow", weight: 5 };
              },
            }).bindPopup(`Length ${len.toFixed(3)}km.`);

            drawnItems.addLayer(newlayer);
            distance_on_waterforest += len;
            fgp.push(curSlc);
          }
        }
      }
    }

    console.log("Total distacnce of line>> ", total_distance.toFixed(3), "km");
    $("#total").html(`Total Path Length: ${total_distance.toFixed(4)}km`);
    $("#over").html(
      `Over Path Length: ${distance_on_waterforest.toFixed(4)}km`
    );
    console.log(
      "Distance over water and forest",
      distance_on_waterforest.toFixed(3),
      "km"
    );
  }

  function getquery(name) {
    if (name == "hospitals") {
      let query = `[out:json][timeout:100];(node[amenity=hospital](around:${radius},${lat},${lng}););out body;`;
      return query;
    } else if (name == "roads") {
      let query = `[out:json][timeout:100];(way[highway](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
      return query;
    } else if (name == "waterbodies") {
      let query = `[out:json][timeout:100];(node[waterway](around:${radius},${lat},${lng});way[waterway](around:${radius},${lat},${lng});way[water](around:${radius},${lat},${lng});node['natural'='water'](around:${radius},${lat},${lng});way[natural=water](around:${radius},${lat},${lng});relation['natural'='water'](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
      return query;
    } else if (name == "forests") {
      let query = `[out:json][timeout:100];(way['natural'='wood'](around:${radius},${lat},${lng});relation['natural'='wood'](around:${radius},${lat},${lng});way['natural'='scrub'](around:${radius},${lat},${lng});relation['natural'='scrub'](around:${radius},${lat},${lng});way['leisure'='park'](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
      return query;
    } else if (name == "electricity") {
      let query = `[out:json][timeout:100];(node[power](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
      return query;
    } else if (name == "educationals") {
      let query = `[out:json][timeout:100];(node['amenity'='school'](around:${radius},${lat},${lng});node['amenity'='college'](around:${radius},${lat},${lng});node['amenity'='university'](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
      return query;
    } else if (name == "elevations") {
      let query = `[out:json][timeout:100];(node['ele'](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
      return query;
    } else {
      alert("Query not defined. check code.");
    }
  }

  async function add_the_data_layer(data_type) {
    let baseUrl = "http://overpass-api.de/api/interpreter?data=";
    let overpassApiUrl = baseUrl + getquery(data_type);
    console.log(overpassApiUrl);

    try {
      console.log("loading start");
      osm_data = await $.ajax({
        url: overpassApiUrl,
        success: function (osmDataAsJson) {
          console.log("loading finish.");
          return osmDataAsJson;
        },
      });
    } catch (error) {
      console.log("error");
      alert(
        "Too many requests.OSM server error. Please wait for some seconds , before making new requests. OR This may due to hosting service not allowed external api request.If you get this error constantly, go to github code and download it and run index.html"
      );
      $(`.databox>input[name="${data_type}"]`).prop("checked", false);
    }

    let geojson_data = osmtogeojson(osm_data);
    if (data_type == "hospitals") {
      var hospitalIcon = new L.Icon({
        iconSize: [27, 27],
        iconAnchor: [13, 27],
        popupAnchor: [1, -24],
        iconUrl: "images/hospital.png",
      });

      let hospitals_layer = await L.geoJson(geojson_data, {
        pointToLayer: function (feature, latlng) {
          return L.marker(latlng, { icon: hospitalIcon });
        },
        onEachFeature: function (feature, layer) {
          layer.bindPopup(
            `<div><h6>Name:${feature.properties.tags.name}</h6>
             <h6>Location:${feature.geometry.coordinates}</h6>
            <h6>Amenity:${feature.properties.tags.amenity}</h6></div>`
          );
        },
      }).addTo(map);

      return hospitals_layer;
    } else if (data_type == "educationals") {
      var educationalIcon = new L.Icon({
        iconSize: [27, 27],
        iconAnchor: [13, 27],
        popupAnchor: [1, -24],
        iconUrl: "images/educational.png",
      });
      let educationals_layer = await L.geoJson(geojson_data, {
        pointToLayer: function (feature, latlng) {
          return L.marker(latlng, { icon: educationalIcon });
        },
        onEachFeature: function (feature, layer) {
          layer.bindPopup(
            `<div><h6>Name:${feature.properties.tags.name}</h6>
             <h6>Location:${feature.geometry.coordinates}</h6>
            <h6>Amenity:${feature.properties.tags.amenity}</h6></div>`
          );
        },
      }).addTo(map);
      return educationals_layer;
    } else if (data_type == "waterbodies") {
      let waterbodies_layer = await L.geoJson(geojson_data, {
        style: function (feature) {
          return { color: "#2f9af7" };
        },
        onEachFeature: function (feature, layer) {
          console.log(feature);
          layer.bindPopup(
            `<div><h6>Name:${feature.properties.tags.name}</h6>
            <h6>Type:Water Body</h6></div>`
          );
        },
      }).addTo(map);
      return waterbodies_layer;
    } else if (data_type == "roads") {
      let roads_layer = await L.geoJson(geojson_data, {
        style: function (feature) {
          return { color: "grey" };
        },
        onEachFeature: function (feature, layer) {
          console.log(feature);
          layer.bindPopup(
            `<div><h6>Name:${feature.properties.tags.name}</h6>
             <h6>Type : Road</h6>
           </div>`
          );
        },
      }).addTo(map);
      return roads_layer;
    } else if (data_type == "electricity") {
      var electricityIcon = new L.Icon({
        iconSize: [27, 27],
        iconAnchor: [13, 27],
        popupAnchor: [1, -24],
        iconUrl: "images/electricity.png",
      });
      let electricity_layer = await L.geoJson(geojson_data, {
        style: function (feature) {
          return { color: "#ff0000", fillOpacity: 0.2 };
        },
        onEachFeature: function (feature, layer) {
          console.log(feature);
          layer.bindPopup(
            `<div>
            <h6>Type : Electricity Node or Tower</h6>
             <h6>Location:${feature.geometry.coordinates}</h6>
            </div>`
          );
        },

        pointToLayer: function (feature, latlng) {
          return L.marker(latlng, { icon: electricityIcon });
        },
      }).addTo(map);
      return electricity_layer;
    } else if (data_type == "forests") {
      let forests_layer = await L.geoJson(geojson_data, {
        style: function (feature) {
          return { color: "green" };
        },
        onEachFeature: function (feature, layer) {
          console.log(feature);
          layer.bindPopup(
            `<div><h6>Name:${feature.properties.tags.name}</h6>
             <h6>Type: Forest/Park/Scrup</h6></div>`
          );
        },
      }).addTo(map);
      return forests_layer;
    } else if (data_type == "elevations") {
      var elevationIcon = new L.Icon({
        iconSize: [27, 27],
        iconAnchor: [13, 27],
        popupAnchor: [1, -24],
        iconUrl: "images/elevation.png",
      });
      let elevations_layer = await L.geoJson(geojson_data, {
        style: function (feature) {
          return { color: "yellow" };
        },
        onEachFeature: function (feature, layer) {
          console.log(feature);
          layer.bindPopup(
            `<div><h6>Name:${feature.properties.tags.name}</h6>
             <h6>Location:${feature.geometry.coordinates}</h6>
            <h6>Elevation:${feature.properties.tags.ele}meter</h6></div>`
          );
        },

        pointToLayer: function (feature, latlng) {
          return L.marker(latlng, { icon: elevationIcon });
        },
      }).addTo(map);
      return elevations_layer;
    } else {
      alert("This data type is not included in code . uffff!");
    }
  }

  //end of document ready
});
