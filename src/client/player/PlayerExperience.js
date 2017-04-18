import * as soundworks from 'soundworks/client';
import * as lfo from 'waves-lfo/client';

const audioContext = soundworks.audioContext;
const client = soundworks.client;

const viewTemplate = `
  <canvas class="background"></canvas>
  <div class="foreground background-beacon">
    <div class="section-top flex-middle">
      <p class="big">Beacon ID: <%= major %>.<%= minor %></p>
    </div>
    <div class="section-center flex-center">
      <p class="small" id="logValues"></p>
    </div>
    <div class="section-bottom flex-middle"></div>
  </div>
`;

// interpolation linéaire

const avgGeneral = [-29.43, -58.16, -62.88, -60.32, -60.34, -66.36, -64.45, -65.58, -62.36, -64.26, -70];
const avgPrecise = [-20, -40.52, -43.65, -49.22, -48.11, -48.57, -51.54, -50.07, -49.25, -55.89, -53.2, -53.25, -58.29, -58.65, -55.67, -56.86, -61.51, -59.94, -61.44, -58.6, -62.88];

function linearInterpolation(rssi) {
  if (avgPrecise[0] >= rssi && rssi > avgGeneral[2]) {
    if (avgPrecise[0] >= rssi && rssi > avgPrecise[1]) {
      return (rssi - avgPrecise[0]) * 0.1 / (avgPrecise[1] - avgPrecise[0]);
    } else if (avgPrecise[1] >= rssi && rssi > avgPrecise[2]) {
      return 0.1 + (rssi - avgPrecise[1]) * 0.1 / (avgPrecise[2] - avgPrecise[1]);
    } else if (avgPrecise[2] >= rssi && rssi > avgPrecise[3]) {
      return 0.2 + (rssi - avgPrecise[2]) * 0.1 / (avgPrecise[3] - avgPrecise[2]);
    } else if (avgPrecise[3] >= rssi && rssi > avgPrecise[6]) {
      return 0.3 + (rssi - avgPrecise[3]) * 0.3 / (avgPrecise[6] - avgPrecise[3]);
    } else if (avgPrecise[6] >= rssi && rssi > avgPrecise[9]) {
      return 0.6 + (rssi - avgPrecise[6]) * 0.3 / (avgPrecise[9] - avgPrecise[6]);
    } else if (avgPrecise[9] >= rssi && rssi > avgPrecise[12]) {
      return 0.9 + (rssi - avgPrecise[9]) * 0.3 / (avgPrecise[12] - avgPrecise[9]);
    } else if (avgPrecise[12] >= rssi && rssi > avgPrecise[20]) {
      return 1.2 + (rssi - avgPrecise[12]) * 0.8 / (avgPrecise[20] - avgPrecise[12]);
    }
  } else if (avgGeneral[2] >= rssi && rssi > avgGeneral[5]) {
      return  2 + (rssi - avgGeneral[2]) * 3 / (avgGeneral[5] - avgGeneral[2]);
  } else if (avgGeneral[5] >= rssi && rssi > avgGeneral[10]) {
      return  5 + (rssi - avgGeneral[5]) * 5 / (avgGeneral[10] - avgGeneral[5]);
  } else {
    return Infinity;
  }
}


// this experience plays a sound when it starts, and plays another sound when
// other clients join the experience
class PlayerExperience extends soundworks.Experience {
  constructor(standalone, assetsDomain, beaconUUID) {
    super();

    this.platform = this.require('platform', { features: ['web-audio'] });
    this.checkin = this.require('checkin', { showDialog: false });

    const beaconConfig = { uuid: beaconUUID };

    if (!window.cordova)
      beaconConfig.emulate = { numPeers: 1 };

    this.beacon = this.require('beacon', beaconConfig);

    // this.isTouching = false;

    this.beaconCallback = this.beaconCallback.bind(this);

    this.doubleTouchWatcher = {
      lastTouchTime: 0, // in sec
      timeThreshold: 0.4 // in sec
    }
  }

  init() {
    // initialize the view
    this.viewTemplate = viewTemplate;
    this.viewContent = { major: this.beacon.major, minor: this.beacon.minor };
    this.viewCtor = soundworks.CanvasView;
    this.viewOptions = { preservePixelRatio: true };
    // this.viewEvents = {
    //   'touchstart': (e) => {
    //     e.preventDefault();
    //     this.isTouching = true;
    //   },
    //   'touchend': (e) => {
    //     e.preventDefault();
    //     this.isTouching = false;
    //   },
    // };
    this.view = this.createView();

    this.movingAverage = new lfo.operator.MovingAverage({
      order: 7,
      fill: -66.19,
    });

    this.movingAverage.initStream({
      frameType: 'scalar',
      frameSize: 1,
    });
  }

  start() {
    super.start(); // don't forget this

    if (!this.hasStarted) {
      this.initBeacon();
      this.init();
    }

    this.show();

    this.$log = document.getElementById('logValues');

    // setup touch listeners (add a marker on the graph)
    const surface = new soundworks.TouchSurface(this.view.$el);
    surface.addListener('touchstart', (id, normX, normY) => {
      // check if fast enough
      if( (audioContext.currentTime - this.doubleTouchWatcher.lastTouchTime) <= this.doubleTouchWatcher.timeThreshold ) {
        const marker = [100];
        this.send('player:touches', marker);
        console.log(marker[0]);
      }
      // update last touch time
      this.doubleTouchWatcher.lastTouchTime = audioContext.currentTime;
    });
  }

  initBeacon() {
    // add callback, invoked whenever beacon scan is executed
    this.beacon.addListener(this.beaconCallback);
    // fake calibration
    this.beacon.txPower = -57.5; // in dB (see beacon service for detail)
    // set major / minor ID based on client id
    this.beacon.major = 0;
    this.beacon.minor = client.index;
    this.beacon.startAdvertising();
    this.beacon.startRanging();
  }

  beaconCallback(pluginResult) {
    // if (this.isTouching) {
      // diplay beacon list on screen
      let log = 'Closeby Beacons: </br></br>';

      const beaconResults = pluginResult.beacons.map((beacon) => {
        const peerIndex = beacon.minor;
        const rssi = beacon.rssi;
        const mean = this.movingAverage.inputScalar(rssi);
        // const dist = this.beacon.rssiToDist(rssi);
        const dist = linearInterpolation(mean);
        return [peerIndex, dist, rssi];
      });

      console.log(beaconResults);
      this.send('player:beacons', beaconResults);

      pluginResult.beacons.forEach((beacon) => {
        const rssi = beacon.rssi;
        const mean = this.movingAverage.inputScalar(rssi);
        // const dist = this.beacon.rssiToDist(rssi);
        const dist = linearInterpolation(mean);

        log += beacon.major + '.' + beacon.minor + '<br />' +
               'rssi: ' + mean + '<br />'  +
               'dist: ' + dist + 'm' + '<br />'  +
               '(' + beacon.proximity + ')' + '<br /><br />';
      });

      this.$log.innerHTML = log;
    // } else {
    //   this.$log.innerHTML = '';
    // }
  }
}

export default PlayerExperience;
