import * as soundworks from 'soundworks/client';

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

// this experience plays a sound when it starts, and plays another sound when
// other clients join the experience
export default class PlayerExperience extends soundworks.Experience {
  constructor(standalone, assetsDomain, beaconUUID) {
    super();

    this.platform = this.require('platform', { features: ['web-audio'] });
    this.checkin = this.require('checkin', { showDialog: false });

    const beaconConfig = { uuid: beaconUUID };

    if (!window.cordova)
      beaconConfig.emulate = { numPeers: 1 };

    this.beacon = this.require('beacon', beaconConfig);

    this.geigerMap = new Map();
    this.isTouching = false;

    this.beaconCallback = this.beaconCallback.bind(this);
  }

  init() {
    // initialize the view
    this.viewTemplate = viewTemplate;
    this.viewContent = { major: this.beacon.major, minor: this.beacon.minor };
    this.viewCtor = soundworks.CanvasView;
    this.viewOptions = { preservePixelRatio: true };
    this.viewEvents = {
      'touchstart': (e) => {
        e.preventDefault();
        this.isTouching = true;
      },
      'touchend': (e) => {
        e.preventDefault();
        this.isTouching = false;
      },
    };
    this.view = this.createView();
  }

  start() {
    super.start(); // don't forget this

    if (!this.hasStarted) {
      this.initBeacon();
      this.init();
    }

    this.show();
  }

  initBeacon() {
    // add callback, invoked whenever beacon scan is executed
    this.beacon.addListener(this.beaconCallback);
    // fake calibration
    this.beacon.txPower = -55; // in dB (see beacon service for detail)
    // set major / minor ID based on client id
    this.beacon.major = 0;
    this.beacon.minor = client.index;
    this.beacon.startAdvertising();
    this.beacon.startRanging();
  }

  beaconCallback(pluginResult) {
    if (this.isTouching) {
      // diplay beacon list on screen
      let log = 'Closeby Beacons: </br></br>';

      pluginResult.beacons.forEach((beacon) => {
        const time = new Date().getTime() / 1000;
        const rssi = beacon.rssi;
        const dist = this.beacon.rssiToDist(rssi);
        this.send('player:beacon', time, rssi, dist);

        this.processBeacon(beacon, dist);

        log += beacon.major + '.' + beacon.minor + '<br />' +
               'rssi: ' + beacon.rssi + '<br />'  +
               'dist: ' + dist + 'm' + '<br />'  +
               '(' + beacon.proximity + ')' + '<br /><br />';
               // 'dist: ' + Math.round(dist * 100) / 100 + 'm' + '</br>'  +
      });
      document.getElementById('logValues').innerHTML = log;
    } else {
      // discard if map empty
      if (this.geigerMap.size == 0) { return; }
      // kill map content
      this.geigerMap.forEach( ( geigerCounter, id ) => {
        geigerCounter.oscillator.stop();
      });
      // clean map
      this.geigerMap = new Map();
      // clean screen log
      document.getElementById('logValues').innerHTML = '';
    }
  }


  processBeacon(beacon, dist) {
    const id = beacon.minor;
    let geigerCounter = null;
    // if beacon ID unregistered
    if( !this.geigerMap.has(id) ) {
      // create instance of geiger counter
      geigerCounter = new GeigerCounter();
      // add geigeir in local map
      this.geigerMap.set(id, geigerCounter);
    } else {
      // fetch geigerCounter instance associated to beacon ID
      geigerCounter = this.geigerMap.get(id);
    }

    // set geiger counter dist
    geigerCounter.setDist(dist);

  }

}


class GeigerCounter {
  constructor () {
    this.oscillator = audioContext.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = 10; // value in hertz
    this.oscillator.start();
    // this.oscillator.connect(audioContext.destination);
  }

  setDist (dist) {
    // mapping of distance to frequency
    let freq = dist*(-74) + 991;
    // change oscillator frequency
    this.oscillator.frequency.value = freq;
  }


}

