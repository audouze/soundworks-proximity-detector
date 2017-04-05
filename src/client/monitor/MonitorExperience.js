import * as soundworks from 'soundworks/client';
import * as lfo from 'waves-lfo/client';


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

    this.graphDist0 = null;
    this.graphDist1 = null;
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

    this.receive('player:beacons', this.traceEvent);
    this.generateGraph();
  }

  generateGraph() {
    console.log('hello');
    const eventInDist0 = new lfo.source.EventIn({
      frameSize: 1,
      frameRate: 0.1,
      frameType: 'vector'
    });

    const eventInDist1 = new lfo.source.EventIn({
      frameSize: 1,
      frameRate: 0.1,
      frameType: 'vector'
    });


    const $container = this.view.$el.querySelector('#canvas-container');


    const bpfDist0 = new lfo.sink.BpfDisplay({
      container: $container,
      duration: 30,
      min: 0,
      max: 5,
      width: 600,
      height: 600,
    });

       const bpfDist1 = new lfo.sink.BpfDisplay({
      container: $container,
      duration: 30,
      min: 0,
      max: 5,
      width: 600,
      height: 600,
      colors: ['green'],
    });


    eventInDist0.connect(bpfDist0);
    eventInDist0.start();
    eventInDist1.connect(bpfDist1);
    eventInDist1.start();


    this.graphDist0 = { eventInDist0, bpfDist0 };
    this.graphDist1 = { eventInDist1, bpfDist1 };
  }

  traceEvent(time, clientIndex, peerIndex, peerDist) {
    if (clientIndex == 0) {
      this.graphDist0.eventInDist0.process(peerDist);
    }
    else {
      this.graphDist1.eventInDist1.process(peerDist);
    }
  }
}

export default MonitorExperience;
