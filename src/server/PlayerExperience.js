import { Experience } from 'soundworks/server';

// server-side 'player' experience.
export default class PlayerExperience extends Experience {
  constructor(clientType) {
    super(clientType);

    this.checkin = this.require('checkin');
    this.sharedConfig = this.require('shared-config');

    this._toMonitor = this._toMonitor.bind(this);
  }

  // if anything needs to append when the experience starts
  start() {}

  // if anything needs to happen when a client enters the performance (*i.e.*
  // starts the experience on the client side), write it in the `enter` method
  enter(client) {
    super.enter(client);

    this.receive(client, 'player:beacon', this._toMonitor(client));
  }

  _toMonitor (client) {
    return (time, rssi, dist) => {
      this.broadcast('monitor', client, 'player:beacon', time, rssi, dist);
    }
  }

  exit(client) {
    super.exit(client);
    // ...
  }
}
