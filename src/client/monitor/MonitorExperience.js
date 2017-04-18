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
    this.graphRssi0 = null;
    this.graphRssi1 = null;
    this.graphMarker = null;

    this.traceEvent = this.traceEvent.bind(this);
    this.traceMarker = this.traceMarker.bind(this);
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
    this.receive('player:touch', this.traceMarker);
    this.generateGraph();
  }

  generateGraph() {
    console.log('hello');
    const eventInDist0 = new lfo.source.EventIn({
      frameSize: 1,
      frameRate: 0.1,
      frameType: 'vector'
    });

    const eventInRssi0 = new lfo.source.EventIn({
      frameSize: 1,
      frameRate: 0.1,
      frameType: 'vector'
    });

    const eventInDist1 = new lfo.source.EventIn({
      frameSize: 1,
      frameRate: 0.1,
      frameType: 'vector'
    });

    const eventInRssi1 = new lfo.source.EventIn({
      frameSize: 1,
      frameRate: 0.1,
      frameType: 'vector'
    });

    const eventInMark = new lfo.source.EventIn({
      frameRate: 0.1,
      frameType: 'vector'
    });


    const $container = this.view.$el.querySelector('#canvas-container');


    const bpfDist0 = new lfo.sink.BpfDisplay({
      container: $container,
      duration: 60,
      min: 0,
      max: 5,
      width: 600,
      height: 600,
    });

    const bpfRssi0 = new lfo.sink.BpfDisplay({
      container: $container,
      duration: 60,
      min: -70,
      max: -20,
      width: 600,
      height: 600,
      colors: ['red'],
    });

     const bpfDist1 = new lfo.sink.BpfDisplay({
    container: $container,
    duration: 60,
    min: 0,
    max: 5,
    width: 600,
    height: 600,
    colors: ['green'],
  });

    const bpfRssi1 = new lfo.sink.BpfDisplay({
  container: $container,
  duration: 60,
  min: -70,
  max: -20,
  width: 600,
  height: 600,
  colors: ['orange'],
});

    const marker = new lfo.sink.MarkerDisplay({
  container: $container,
  duration: 60,
  referenceTime : 0,
  width: 600,
  height: 600,
  color: 'lightgrey',
});



    eventInDist0.connect(bpfDist0);
    eventInDist0.start();

    eventInRssi0.connect(bpfRssi0);
    eventInRssi0.start();

    eventInDist1.connect(bpfDist1);
    eventInDist1.start();

    eventInRssi1.connect(bpfRssi1);
    eventInRssi1.start();

    eventInMark.connect(marker);
    eventInMark.start();


    this.graphDist0 = { eventInDist0, bpfDist0 };
    this.graphDist1 = { eventInDist1, bpfDist1 };
    this.graphRssi0 = { eventInRssi0, bpfRssi0 };
    this.graphRssi1 = { eventInRssi1, bpfRssi1 };
    this.graphMarker = { eventInMark, marker};
  }

  traceEvent(time, clientIndex, peerIndex, peerDist, peerRssi) {
    if (peerIndex == 0) {
      this.graphDist0.eventInDist0.process(time, peerDist);
      // this.graphRssi0.eventInRssi0.process(time, peerRssi);
      console.log('RSSI 1 :', peerRssi);
    }
    else {
      this.graphDist1.eventInDist1.process(time, peerDist);
      // this.graphRssi1.eventInRssi1.process(time, peerRssi);
      console.log('RSSI 2 :', peerRssi);
    }
  }

  traceMarker(time, mark) {
    this.graphMarker.eventInMark.process(time, mark);
    console.log(time, mark);
  }
}

export default MonitorExperience;
