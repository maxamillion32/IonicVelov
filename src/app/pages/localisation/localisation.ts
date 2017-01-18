import { Component, ViewChild, OnInit } from '@angular/core';
import { Geolocation } from 'ionic-native';
import { Keyboard } from 'ionic-native';

import { FileService } from '../../services/file.service';
import { StationService } from '../../services/station.service';
import { Station } from '../../models/station';
import { LoadingController } from 'ionic-angular';
import { Network } from 'ionic-native';
import { ToastController, Searchbar } from 'ionic-angular';

import ol from 'openlayers';

const TEXT_MY_POSITION = "Ma position";
const TEXT_SELECTED = "Sélection";
const TEXT_THANKS_WAITING = "Merci de patienter...";
const TEXT_YES = "Oui";
const JSON_CLOSED = "CLOSED";

@Component({
  selector: 'localisation-page',
  templateUrl: 'localisation.html'
})
export class LocalisationPage implements OnInit {
  @ViewChild('map') mapChild;           //Child map in HTML
  @ViewChild('searchbar') searchbar: Searchbar;   //Child searchBar in HTML
  loader: any;                          //Loader
  stations: Station[];                  //Station list
  stationsFiltered: Station[];          //Station filtered (for search input)
  stationSelected: any;                 //Selected station
  mapOl: any;                           //Ol map
  targetPoint: ol.Feature;              //Blue point
  featureSelected: any;                 //Selected feature
  notConnected: boolean;                //Is device connected to internet ?
  myPosition : ol.Feature;              //Position of user
  searchVisible: boolean = false;       //Is search field visible ?
  stationFilter: String;                //Search filter
  vL_All: ol.layer.Vector;              //All vector


  constructor(
    private stationService: StationService,
    private loadingCtrl: LoadingController,
    private fileService: FileService,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {

    this.notConnected = Network.connection === "none";
    this.stationFilter = "";
    this.loader = this.loadingCtrl.create({
      content: TEXT_THANKS_WAITING,
      duration: 2000
    });
    this.loader.present();
    this.getStations();
  }

  getStations() {
    this.stationService.getStations()
      .subscribe(stations => {
        this.stations = stations;
        this.loadMap();
      });
  }

  loadMap() {
    Geolocation.getCurrentPosition().then((resp) => {
      this.getPrefered(resp);
    }).catch((error) => {
      console.log('Error getting location', error);
    })
  }

  getPrefered(resp) {
    this.fileService.readFavoritesFromFile().then(prefered => {
      this.createMap(resp, prefered);
    });
  }

  createMap(resp, prefered) {

    var long = resp.coords.longitude;
    var lat = resp.coords.latitude;

    var tempFeature;
    var fS_Closed = [];
    var fS_Empty = [];
    var fS_Full = [];
    var fS_Available = [];
    var fS_MyPosition = [];
    var fS_Target = [];
    var fS_Bonus = [];
    var fS_All = [];

    this.stations.forEach(element => {

      tempFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([parseFloat(element.lng), parseFloat(element.lat)])),
        name: element.name,
        status: element.status,
        bikeStands: element.bike_stands,
        available: element.available_bike_stands,
        gid: element.gid,
        lat: element.lat,
        lng: element.lng,
        bonus: element.bonus == TEXT_YES,
        favorite: prefered.indexOf(element.gid) >= 0
      });

      if (element.status == JSON_CLOSED) {
        fS_Closed.push(tempFeature);
      } else if (element.available_bikes == "0") {
        fS_Empty.push(tempFeature);
      } else if (element.available_bike_stands == "0") {
        fS_Full.push(tempFeature);
      } else {
        fS_Available.push(tempFeature);
      }

      if (element.bonus == TEXT_YES) {
        fS_Bonus.push(tempFeature);
      }

      fS_All.push(tempFeature);
    });

    var iconStyle = new ol.style.Style({
      image: new ol.style.Icon(({
        anchor: [128, 20],
        scale: 0.2,
        anchorOrigin: "bottom-left",
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
        src: 'assets/img/pin.png'
      }))
    });

    this.myPosition = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([long, lat])),
      name: TEXT_MY_POSITION
    });
    fS_MyPosition.push(this.myPosition);

    this.targetPoint = new ol.Feature({
      name: TEXT_SELECTED
    });
    fS_Target.push(this.targetPoint);

    var vS_Closed = new ol.source.Vector({ features: fS_Closed });
    var vS_Empty = new ol.source.Vector({ features: fS_Empty });
    var vS_Full = new ol.source.Vector({ features: fS_Full });
    var vS_Available = new ol.source.Vector({ features: fS_Available });
    var vS_MyPosition = new ol.source.Vector({ features: fS_MyPosition });
    var vS_Target = new ol.source.Vector({ features: fS_Target });
    var vS_Bonus = new ol.source.Vector({ features: fS_Bonus });
    var vS_All = new ol.source.Vector({ features: fS_All });

    var vL_Closed = new ol.layer.Vector({ source: vS_Closed, style: this.createStyle("red", 8) });
    var vL_Empty = new ol.layer.Vector({ source: vS_Empty, style: this.createStyle("orange", 8) });
    var vL_Full = new ol.layer.Vector({ source: vS_Full, style: this.createStyle("yellow", 8) });
    var vL_Available = new ol.layer.Vector({ source: vS_Available, style: this.createStyle("green", 8) });
    var vL_MyPosition = new ol.layer.Vector({ source: vS_MyPosition, style: iconStyle });
    var vL_MyTarget = new ol.layer.Vector({ source: vS_Target, style: this.createStyle("blue", 10) });
    var vL_Bonus = new ol.layer.Vector({ source: vS_Bonus, style: this.createStyle("black", 2) });


    this.vL_All = new ol.layer.Vector({ source: vS_All });

    var mapImg = new ol.layer.Tile({
      source: new ol.source.OSM()
    });

    this.mapOl = new ol.Map({
      target: "map",
      layers: [mapImg, vL_Closed, vL_Empty, vL_Full, vL_Available, vL_MyPosition, vL_MyTarget, vL_Bonus],
      overlays: [new ol.Overlay({ element: document.getElementById('popup') })],
      view: new ol.View({
        center: ol.proj.fromLonLat([long, lat]),
        zoom: 15,
        minZoom: 6,
        maxZoom: 18
      }),
      controls : ol.control.defaults().extend([
          new ol.control.Zoom(),
          new ol.control.ZoomSlider()
        ])
    });

    this.loader.dismiss();
    this.updateScreen();
  }

  updateScreen() {
    setTimeout(() => {  
      this.notConnected = Network.connection === "none";

      Geolocation.getCurrentPosition().then((resp) => {
        var long = resp.coords.longitude;
        var lat = resp.coords.latitude;
        this.myPosition.setGeometry(new ol.geom.Point(ol.proj.fromLonLat([long, lat])));
      }).catch((error) => {
        console.log('Error getting location', error);
      })

      this.updateScreen();
    }, 1000);
  }

  createStyle(color, taille) {
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: taille,
        stroke: new ol.style.Stroke({
          color: 'black',
          width: 3
        }),
        fill: new ol.style.Fill({ color: color })
      })
    });
  }

  clickOnStar(station) {
    this.stationSelected.favorite = !this.stationSelected.favorite;
    this.featureSelected.set("favorite", !this.featureSelected.get("favorite"));
    if (this.stationSelected.favorite) {
      this.fileService.addStationToFile(station.gid);
      this.presentToast("Station " + station.name + " ajoutée aux favoris");
    }
    else {
      this.fileService.removeStationToFile(station.gid);
      this.presentToast("Station " + station.name + " supprimée des favoris");
    }
  }

  clickCloser() {
    this.stationSelected = null;
    this.targetPoint.setGeometry(null);
  }

  clickMap(event) {
    var coord = [event.layerX, event.layerY];
    console.log(coord);
    var feature = this.mapOl.forEachFeatureAtPixel(coord,
      function (feature, layer) {
        return feature;
      }
    );
    this.featureSelected = feature;
    this.showPopup(feature);
  }

  showSearchList() {
    this.searchVisible = true;
    /*setTimeout(() => {
      this.searchbar.setFocus();
    });*/
  }

  hideSearchList() {
    this.searchVisible = false;
    Keyboard.close();
  }

  searchStations() {
    this.stationsFiltered = this.stations.filter((station) => {
      return station.name.toLowerCase().indexOf(this.stationFilter.toLowerCase()) > -1;
    });
  }

  selectStation(station: Station) {
    var feature = this.vL_All.getSource().forEachFeature((feature) => {
      var properties = feature.getProperties();

      if (properties["name"] == station.name)
        return feature;
    });

    this.featureSelected = feature;
    this.hideSearchList();
    this.showPopup(feature);
  }

  showPopup(feature) {
    if (feature && feature.get("name") != TEXT_MY_POSITION && feature.get("name") != TEXT_SELECTED) {
      this.stationSelected = {};
      this.stationSelected.name = feature.get("name");
      this.stationSelected.status = feature.get("status") == "OPEN" ? "Ouverte" : "Fermée";
      this.stationSelected.bikestand = feature.get("bikeStands");
      this.stationSelected.available = feature.get("available");
      this.stationSelected.favorite = feature.get("favorite");
      this.stationSelected.gid = feature.get("gid");
      this.stationSelected.bonus = feature.get("bonus");

      this.targetPoint.setGeometry(new ol.geom.Point(feature.getGeometry().getCoordinates()));
      this.mapOl.getView().setCenter(feature.getGeometry().getCoordinates());
    }
  }

  presentToast(p_message) {
    let toast = this.toastCtrl.create({
      message: p_message,
      duration: 3000
    });
    toast.present();
  }
}
