Arbiter.Validator = (function() {


  return{

           startValidation : function(attributeJsonArr, qaOptionJsonArr, layerNameArr, FIDArr) {

           //Loading UI
           Android.StartValidationProgressDialog();

            var map = Arbiter.Map.getMap();

            var index;
            var aoiLayer;
            var aoiFeature;
            var multiPolygonObject = new OpenLayers.Geometry.MultiPolygon();
            var geoJsonFormat = new OpenLayers.Format.GeoJSON();
            var featureVector = new OpenLayers.Feature.Vector();
            var extentLayer = new OpenLayers.Layer.Vector();


            for(var i=0; i<map.layers.length; i++)
            {
            if(map.layers[i].name == "aoi")
                 index = i;
            }

            aoiLayer = map.layers[index];
            aoiFeature = aoiLayer.getFeaturesByAttribute()[0];
            multiPolygonObject.addComponent(aoiFeature.geometry);
            geoJsonFormat.parseFeature(multiPolygonObject);
            featureVector.geometry = multiPolygonObject;
            extentLayer.addFeatures(featureVector);

            //call aoi extent geojson format.
            var extentValue =  geoJsonFormat.write(extentLayer.getFeaturesByAttribute());
            var extentObj = JSON.parse(extentValue);
            extentObj.features[0].id = "valiExtent";

            var i = 0;
            var validationGeoJson;
            var layers = { };

            while(map.layers[i] != null)
            {
            if(map.layers[i].name.indexOf("wfs") != -1)
            {
              for(var j=0; j<FIDArr.length; j++)
              {
              if(map.layers[i].features[0].fid.indexOf(FIDArr[j]) != -1)
              {
               layers[layerNameArr[j]] = { feature : geoJsonFormat.write(map.layers[i].getFeaturesByAttribute()), attribute : attributeJsonArr[j], qaOption : qaOptionJsonArr[j], weight : 0 };
              }
              }
            }
            i++;
            }

            validationGeoJson = { extent : JSON.stringify(extentObj), layers };
            console.log("validationGeoJson : " + validationGeoJson, validationGeoJson);

            //send geojson data to validation server
            // CALL BACK METHOD가 오기전까지 비동기처리하여 UI 로딩 생성
            Arbiter.Validator.sendObjectRequest("http://175.116.181.13:8080/opengds/validator/validate.ajax", validationGeoJson, Arbiter.Validator.doneCallback);
        },

        sendObjectRequest : function(url, params, doneCallback)
        {
           var deferredObj =
           		$.ajax({
           		url : url,
           		type : "POST",
           		dataType : "json",
           		contentType : "application/json; charset=UTF-8",
           		cache : false,
           		data : JSON.stringify(params),
           		traditional: true
           	});
           	deferredObj.done(function(data, textStatus, jqXHR) {
           		Arbiter.Validator.processDone(data, textStatus, jqXHR, doneCallback);
           	});
           	deferredObj.fail(function(jqXHR, textStatus, errorThrown) {
           		Arbiter.Validator.processFail(jqXHR, textStatus, errorThrown);
           	});
           	return deferredObj;
        },

        processDone : function(data, textStatus, jqXHR, doneCallback)
        {
          	if (typeof(data) !== 'undefined' && typeof(data.errorCode) !== 'undefined') {
          		alertPopup("Inform",data.errorDesc);
          	} else if (typeof(doneCallback) !== 'undefined') {
          		doneCallback(data);
          	}
        },

        processFail : function(jqXHR, textStatus, errorThrown)
        {
            Android.ValidationFailProgressDialog();

          	if (typeof (console) !== 'undefined' && typeof (console.log) !== 'undefined') {
          		console.log(textStatus + " - " + jqXHR.status + " (" + errorThrown + ")");
          	}
          	if (jqXHR.status == 500) {
          		alert("Internal System Error");
          	} else if (jqXHR.status == 404) {
          		alert("Not Found / Wrong path");
          	} else if (jqXHR.status == 408) {
          		alert("Please try again in a few seconds");
          	}
          	if (jqXHR.getResponseHeader("SESSION_EXPIRED") != null) {
          		alert("Session Expired");
          	}
        },

        doneCallback : function(result)
        {
          console.log("Validation result" + result, result);
          //Confirm

          // ERROR 표시 함수 호출
          if(result.Error != false)
            Arbiter.Validator.resultErrorMarking(result);


          // JS INTERFACE 이용하여 자바로 ERROR REPORT DATA 보내기
          if(result.Error != false)
          Android.SaveValidationResult(JSON.stringify(result),true);

          else
          Android.SaveValidationResult(JSON.stringify(result),false);

        },

        //show marking point if error exists
        resultErrorMarking : function(result)
        {
           var layer;
           var map = Arbiter.Map.getMap();
           var errorResults = result.DetailsReport;
           var markingPoints = new Array();
           var renderer = OpenLayers.Util.getParameters(window.location.href).renderer;

           renderer = (renderer) ? [renderer] : OpenLayers.Layer.Vector.prototype.renderers;

           for(var i=0; i<errorResults.length; i++)
           {
              markingPoints[i] = new OpenLayers.Feature.Vector(
                 new OpenLayers.Geometry.Point(
                      errorResults[i].errCoorX, errorResults[i].errCoorY));
           }

            var i=0;
                       while(map.layers[i] != null)
                       {
                          if(map.layers[i].name == "ErrorMarking")
                            {
                              layer = map.layers[i];
                            }
                            i++;
                       }
        if(layer==null){
            layer = new OpenLayers.Layer.Vector('ErrorMarking', {
                                                        styleMap: new OpenLayers.StyleMap({
                                                            pointRadius: map.getResolution() + 5,
                                                            fillOpacity: 0,
                                                            strokeColor : "#FF0000"
                                                        }),
                                                        renderers: renderer
                                                    });
        }
        else{
           layer.removeAllFeatures();
        }
           layer.addFeatures(markingPoints);
           map.addLayer(layer);
        },

        removeErrorMarking : function(){

                    var map = Arbiter.Map.getMap();
                    var i=0;

                         while(map.layers[i] != null)
                          {
                             if(map.layers[i].name == "ErrorMarking")
                               {
                                  map.removeLayer(map.layers[i]);
                                  continue;
                               }
                               i++;
                          }
        },

  //ADD FUNCTION FOR navigate feature
  		navigateFeature: function(layerId, fid){

  		            var map = Arbiter.Map.getMap();

          			var layer = Arbiter.Layers.getLayerById(layerId, Arbiter.Layers.type.WFS);

           			var feature = layer.getFeatureByFid(fid);

           			var controlPanel = Arbiter.Controls.ControlPanel;

           			controlPanel.unselect();

           			if(Arbiter.Util.existsAndNotNull(feature)){
           				feature.geometry.calculateBounds();
           				var bounds = feature.geometry.getBounds();

           				var zoomForExtent = map.getZoomForExtent(bounds);

           				if(zoomForExtent > 18){

           					var centroid = feature.geometry.getCentroid();

           					map.setCenter(new OpenLayers.LonLat(centroid.x, centroid.y), 18);
           				}else{

           					map.zoomToExtent(bounds);
           				}

           				controlPanel.select(feature);
           			}
          		}
	};
})();