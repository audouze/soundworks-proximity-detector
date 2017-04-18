import { Service, serviceManager } from 'soundworks/client';

/* based on cordova-plugin-ibeacon: https://github.com/petermetz/cordova-plugin-ibeacon.git */
const SERVICE_ID = 'service:beacon';

const CORDOVA_PLUGIN_NAME = 'com.unarin.cordova.beacon';
const CORDOVA_PLUGIN_ASSERTED_VERSION = '3.3.0';
const CORDOVA_PLUGIN_REPOSITORY = 'https://github.com/petermetz/cordova-plugin-ibeacon.git';

class Beacon extends Service {
  /** _<span class='warning'>__WARNING__</span> This class should never be instanciated manually_ */
  constructor() {
    super(SERVICE_ID, false);

    /**
     * - uuid represent the beacon region. a given ranging callback can obly monitor
     * beacons with the same uuid, hence uuid in the soundwork beacon service is hardcoded.
     * - identifier came with the cordova-plugin-ibeacon API, no real cues why it's there.
     * - major / minor: each encoded on 16 bits, these values are to be used to defined a
     * unique soundwork client.
     */
    const defaults = {
      uuid: '74278BDA-B644-4520-8F0C-720EAF059935',
      major: Math.floor(Math.random() * 65500),
      minor: Math.floor(Math.random() * 65500),
      txPower: -57.5,
      debug: false,
      skipService: false,
      emulate: null,
    };

    this.configure(defaults);

    this._identifier = 'advertisedBeacon';
    // local attributes
    this._cordovaPluginInstalled = false;
    this._hasBeenCalibrated = false;
    this._callbacks = new Set();

    this._emulatedBeacons = [];
    // bind local methods
    this._didRangeBeaconsInRegion = this._didRangeBeaconsInRegion.bind(this);
  }

  /**
   * Get advertising iBeacon region UUID
   */
  get uuid() {
    return this.options.uuid;
  }

  /**
   * Set advertising iBeacon UUID
   * @param {String} val - new UUID
   */
  set uuid(val) { // USE AT YOUR OWN RISKS
    this.options.uuid = val;
  }

  /**
   * Get advertising iBeacon major ID
   */
  get major() {
    return this.options.major;
  }

  /**
   * Set advertising iBeacon major ID
   * @param {Number} val - new major ID
   */
  set major(val) {
    if ((val <= 65535) && (val >= 0))
      this.options.major = val;
    else
      console.warn('WARNING: attempt to define invalid major value: ', val, ' (must be in range [0,65535]');
  }

  /**
  * Get advertising iBeacon minor ID
  */
  get minor() {
    return this.options.minor;
  }

  /**
  * Set advertising iBeacon minor ID
  * @param {Number} val - new minor ID
  */
  set minor(val) {
    if (val >= 0 && val <= 65535)
      this.options.minor = val;
    else
      console.warn('WARNING: attempt to define invalid minor value: ', val, ' (must be in range [0,65535]');
  }

  /**
  * Get reference signal strength, used for distance estimation.
  * txPower is the rssi (in dB) as mesured by another beacon
  * located at 1 meter away from this beacon.
  */
  get txPower() {
    return this.options.txPower;
  }

  /**
  * Get reference signal strength, used for distance estimation.
  * txPower is the rssi (in dB) as mesured by another beacon
  * located at 1 meter away from this beacon.
  * @param {Number} val - new signal strength reference
  */
  set txPower(val) {
    if (val >= -200 && val <= 0) {
      this.options.txPower = val;
      this._hasBeenCalibrated = true;
    } else {
      console.warn('WARNING: a reference txPower value of: ', val, ' dB is unlikely (set has been rejected)');
    }
  }

  /** @private */
  start() {
    super.start();

    if (!this.hasStarted)
      this.init();

    if (this.options.skipService) {
      this.ready();
      this.startAdvertising = () => {};
      this.restartAdvertising = () => {};
      this.startRanging = () => {};
      this.restartRanging = () => {};
      return;
    }

    // service ready when plugin is checked
    if (this.options.emulate === null) {
      this._checkPlugin().then(isChecked => {
        if (isChecked)
          this.ready();

        if (this.options.debug === false) {
          cordova.plugins.locationManager.disableDebugNotifications();
          cordova.plugins.locationManager.disableDebugLogs();
        }
      });
    } else {
      this.ready();
      this.startAdvertising = () => {};
      this.restartAdvertising = () => {};
      this._rangingIntervalId = null;

      this.startRanging = () => {
        clearInterval(this._rangingIntervalId);

        this._emulatedBeacons.length = 0;
        const numPeers = this.options.emulate.numPeers;
        let minor = 0;

        for (let i = 0; i < numPeers; i++) {
          if (minor === this.options.minor)
            minor += 1;

          const peerResult = {
            major: this.options.major,
            minor: minor,
            rssi: -1 * (80 * Math.random() + 20),   // [-20, -100]
            proximity: 'hi',
          }

          minor += 1;

          this._emulatedBeacons.push(peerResult);
        }

        this._rangingIntervalId = setInterval(() => {
          this._emulatedBeacons.forEach((res) => {
            res.rssi += Math.random() * 6 - 3;
            res.rssi = Math.max(-100, Math.min(-20, res.rssi));
          });

          this._didRangeBeaconsInRegion({ beacons: this._emulatedBeacons });
        }, 1000);
      };

      this.restartRanging = this.startRanging;
    }
  }

  /**
   * Register a function that will be invoked when neighboring ibeacon list is updated
   * (i.e. every nth millisec. once a single beacon is registered)
   * @param {Function} callback
   */
  addListener(callback) {
    this._callbacks.add(callback);
  }

  /**
   * remove registered callback from stack (see 'addCallback')
   */
  removeListener(callback) {
    if (this._callbacks.has(callback))
      this._callbacks.delete(callback);
  }

  startAdvertising() {
    this._startAdvertising();
  }

  startRanging() {
    this._startRanging();
  }

  /**
   * Restart advertising to take into acount uuid, major or minor change.
   */
  restartAdvertising() {
    this._stopAdvertising();
    this._startAdvertising();
  }

  /**
   * Restart ranging to take into acount uuid change.
   */
  restartRanging() {
    this._stopRanging();
    this._startRanging();
  }

  /**
   * remove registered callback from stack (see 'addCallback')
   */
  rssiToDist(rssi) {
    if (!this._hasBeenCalibrated) {
      console.warn('rssiToDist called prior to txPower definition (calibration), using default value:', this.options.txPower, 'dB');
      this._hasBeenCalibrated = true;
    }

    return this._calculateAccuracy(this.txPower, rssi);
  }

  /** @private */
  _startAdvertising() {
    if (this._cordovaPluginInstalled) {
      const identifier = this._identifier;
      const uuid = this.options.uuid;
      const minor = this.options.minor;
      const major = this.options.major;
      const beaconRegion = new cordova.plugins.locationManager.BeaconRegion(identifier, uuid, major, minor);

      // verify the platform supports transmitting as a beacon
      cordova.plugins.locationManager
        .isAdvertisingAvailable()
        .then(function(isSupported) {
          if (isSupported) {
            // start advertising
            cordova.plugins.locationManager
              .startAdvertising(beaconRegion)
              .fail(console.error)
              .done();
          } else {
            console.log('Advertising not supported');
          }
        })
        .fail(function(e) { console.error(e); })
        .done();
    }
  }

  /** @private */
  _stopAdvertising() {
    if (this._cordovaPluginInstalled) {
      cordova.plugins.locationManager
        .stopAdvertising()
        .fail(function(e) { console.error(e); })
        .done();
    }
  }

  /** @private */
  _startRanging() {
    if (this._cordovaPluginInstalled) {
      const delegate = new cordova.plugins.locationManager.Delegate();
      delegate.didRangeBeaconsInRegion = this._didRangeBeaconsInRegion;
      cordova.plugins.locationManager.setDelegate(delegate);

      const uuid = this.options.uuid;
      const identifier = this._identifier;
      const beaconRegion = new cordova.plugins.locationManager.BeaconRegion(identifier, uuid);

      // required in iOS 8+
      cordova.plugins.locationManager.requestWhenInUseAuthorization();
      // or cordova.plugins.locationManager.requestAlwaysAuthorization()

      cordova.plugins.locationManager
        .startRangingBeaconsInRegion(beaconRegion)
        .fail(function(e) { console.error(e); })
        .done();
    }
  }

  /** @private */
  _stopRanging() {
    if (this._cordovaPluginInstalled) {
      const uuid = this.options.uuid;
      const identifier = this._identifier;
      const beaconRegion = new cordova.plugins.locationManager.BeaconRegion(identifier, uuid);

      cordova.plugins.locationManager
        .stopRangingBeaconsInRegion(beaconRegion)
        .fail(function(e) { console.error(e); })
        .done();
    }
  }

  /** @private */
  _didRangeBeaconsInRegion(pluginResult) {
    const beacons = pluginResult.beacons;
    for (let i = 0; i < beacons.length; i++) {
      if (beacons[i].rssi === 0)
        beacons[i].rssi = +Infinity;
    }
    // call user defined callbacks
    this._callbacks.forEach(function(callback) {
      callback(pluginResult);
    });
  }

  /** @private */
  _checkPlugin() {
    const plugins = cordova.require('cordova/plugin_list').metadata;
    let displayInstallInstructions = false;

    if (plugins[CORDOVA_PLUGIN_NAME] === undefined) {
      const msg = 'Cordova plugin <cordova-plugin-ibeacon> not installed -> beacon service disabled';
      console.warn(msg);

      displayInstallInstructions = true;
    } else {
      if (plugins[CORDOVA_PLUGIN_NAME] !== CORDOVA_PLUGIN_ASSERTED_VERSION) {
        const msg = `Cordova plugin <cordova-plugin-ibeacon> version mismatch: installed:
          ${plugins[CORDOVA_PLUGIN_NAME]} required: ${CORDOVA_PLUGIN_ASSERTED_VERSION} (version not tested, use at your own risk)`;
        console.warn(msg);

        displayInstallInstructions = true;
      }

      this._cordovaPluginInstalled = true;
    }

    if (displayInstallInstructions) {
      const msg = `
        -> to install ${CORDOVA_PLUGIN_NAME} v${CORDOVA_PLUGIN_ASSERTED_VERSION}, use:
        cordova plugin add ${CORDOVA_PLUGIN_REPOSITORY}#${CORDOVA_PLUGIN_ASSERTED_VERSION}`;
      console.log(msg);
    }

    if (this._cordovaPluginInstalled)
      return Promise.resolve(true);
    else
      return Promise.resolve(false);
  }

  /**
   * @private
   * convert rssi to distance, naming (_calculateAccuracy rather than calculateDistance)
   * is intentional: USE WITH CAUTION, as explained @
   * http://stackoverflow.com/questions/20416218/understanding-ibeacon-distancing
   */
  _calculateAccuracy(txPower, rssi) {
    if (rssi === 0)
      return 0.0;

    // const txPower = -57.5;
    // if (ratio < 1.0)
    //   return Math.pow(ratio, 10);
    // else
    return 1.0998 * (Math.pow(rssi / txPower, 7.4095) + 0.0110);
  }
}

serviceManager.register(SERVICE_ID, Beacon);

export default Beacon;
