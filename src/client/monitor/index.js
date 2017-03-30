// import client side soundworks and player experience
import * as soundworks from 'soundworks/client';
import MonitorExperience from './MonitorExperience';
import viewTemplates from '../shared/viewTemplates';
import viewContent from '../shared/viewContent';

// launch application when document is fully loaded
const init = () => {
  // configuration received from the server through the `index.html`
  // @see {~/src/server/index.js}
  // @see {~/html/default.ejs}
  const { appName, clientType, websockets, assetsDomain, standalone, beaconUUID }  = window.soundworksConfig;
  // initialize the 'player' client
  soundworks.client.init(clientType, { appName, websockets });
  soundworks.client.setViewContentDefinitions(viewContent);
  soundworks.client.setViewTemplateDefinitions(viewTemplates);

  // create client side (player) experience
  const experience = new MonitorExperience();

  // start the client
  soundworks.client.start();
};

window.addEventListener('load', init);
