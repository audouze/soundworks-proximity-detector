import * as soundworks from 'soundworks/client';
import * as lfo from 'waves-lfo/client';
import * as d3 from 'd3';

const audioContext = soundworks.audioContext;
const client = soundworks.client;

const viewTemplate = `
  <div id="canvas-container"></div>
`;

// this experience plays a sound when it starts, and plays another sound when
// other clients join the experience
class MonitorExperience extends soundworks.Experience {
  constructor() {
    super();

    this.graphRssi = null;
    this.graphDist = null;
    this.traceEvent = this.traceEvent.bind(this);
  }

  init() {
    // initialize the view
    this.viewTemplate = viewTemplate;
    this.viewCtor = soundworks.View;
    this.viewOptions = { preservePixelRatio: true };
    this.view = this.createView();
  }

  start() {
    super.start(); // don't forget this

    if (!this.hasStarted)
      this.init();

    this.show();

    this.receive('player:beacon', this.traceEvent);
    this.generateGraph();
  }

  // _display (dist, rssi) {
  //   console.log(dist, rssi);
  // }

  generateGraph() {
    const eventInRssi = new lfo.source.EventIn({
      frameSize: 1,
      frameRate: 0.1,
      frameType: 'vector'
    });

    const eventInDist = new lfo.source.EventIn({
      frameSize: 1,
      frameRate: 0.1,
      frameType: 'vector'
    });

    const $container = this.view.$el.querySelector('#canvas-container');

    const bpfRssi = new lfo.sink.BpfDisplay({
      container: $container,
      duration: 30,
      min: -100,
      max: 0,
      width: 600,
      height: 600,
      colors: ['red'],
    });

    const bpfDist = new lfo.sink.BpfDisplay({
      container: $container,
      duration: 30,
      min: 0,
      max: 10,
      width: 600,
      height: 600,
    });

    eventInRssi.connect(bpfRssi);
    eventInDist.connect(bpfDist);
    eventInRssi.start();
    eventInDist.start();

    this.graphRssi = { eventInRssi, bpfRssi };
    this.graphDist = { eventInDist, bpfDist };
  }

  traceEvent(time, rssi, dist) {
    this.graphRssi.eventInRssi.process(time, rssi);
    this.graphDist.eventInDist.process(time, dist);
  }
}

export default MonitorExperience;
