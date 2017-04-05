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
class PlayerExperience extends soundworks.Experience {
  constructor(standalone, assetsDomain, beaconUUID) {
    super();

    this.platform = this.require('platform', { features: ['web-audio'] });
    this.checkin = this.require('checkin', { showDialog: false });

    const beaconConfig = { uuid: beaconUUID };

    if (!window.cordova)
      beaconConfig.emulate = { numPeers: 1 };

    this.beacon = this.require('beacon', beaconConfig);

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

    this.$log = document.getElementById('logValues');
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

      const beaconResults = pluginResult.beacons.map((beacon) => {
        const peerIndex = beacon.minor;
        console.log(client.index, peerIndex);
        const dist = this.beacon.rssiToDist(beacon.rssi);
        return [peerIndex, dist];
      });

      console.log(beaconResults);
      this.send('player:beacons', beaconResults);

      pluginResult.beacons.forEach((beacon) => {
        const rssi = beacon.rssi;
        const dist = this.beacon.rssiToDist(rssi);

        log += beacon.major + '.' + beacon.minor + '<br />' +
               'rssi: ' + rssi + '<br />'  +
               'dist: ' + dist + 'm' + '<br />'  +
               '(' + beacon.proximity + ')' + '<br /><br />';
      });

      this.$log.innerHTML = log;
    } else {
      this.$log.innerHTML = '';
    }
  }
}

export default PlayerExperience;
