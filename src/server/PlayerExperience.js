import { Experience } from 'soundworks/server';
import * as lfo from 'waves-lfo/node';
import path from 'path';

// server-side 'player' experience.
export default class PlayerExperience extends Experience {
  constructor(clientType) {
    super(clientType);

    this.checkin = this.require('checkin');
    this.sharedConfig = this.require('shared-config');
    this.sync = this.require('sync');
  }

  // if anything needs to append when the experience starts
  start() {
    const source = new lfo.source.EventIn({
      frameType: 'vector',
      frameSize: 3,
      frameRate: 0,
    });

    const time = new Date().getTime();
    const sink = new lfo.sink.DataToFile({
      filename: path.join(process.cwd(), 'tracer', 'assets', `${time}.json`),
      format: 'json',
    });

    source.connect(sink);
    source.start();

    this.movingAvgDist = new lfo.operator.MovingAverage({ order: 5 });
    this.movingAvgDist.initStream({ frameSize: 1, frameType: 'scalar' });

    this.lfoSource = source;
  }

  // if anything needs to happen when a client enters the performance (*i.e.*
  // starts the experience on the client side), write it in the `enter` method
  enter(client) {
    super.enter(client);

    this.receive(client, 'player:beacons', this._sendToMonitor(client));
    this.receive(client, 'player:beacons', this._averageEstimation(client));
  }

  _sendToMonitor(client) {
    return (beaconResults) => {
      const first = beaconResults[0];
      const time = this.sync.getSyncTime();
      const peerIndex = first[0];
      const peerDist = first[1];
      const clientIndex = client.index;
      this.broadcast('monitor', client, 'player:beacons', time, clientIndex, peerIndex, peerDist);
      console.log(time, client.index, peerIndex, peerDist);

      this.lfoSource.process(time, [client.index, peerIndex, peerDist]);
    }
  }

  _averageEstimation(client) {
    return (beaconResults) => {
      const first = beaconResults[0];
      const time = this.sync.getSyncTime();
      const peerIndex = first[0];
      const peerDist = first[1];
      const avgDist = this.movingAvgDist.inputScalar(peerDist);

      this.lfoSource.process(time, [-1, -1, avgDist]);
    }
  }

  exit(client) {
    this.lfoSource.stop();

    super.exit(client);
  }
}
