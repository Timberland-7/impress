'use strict';

// Web Application Firewall for Impress Application Server

const firewall = {};
api.firewall = firewall;

firewall.ACCESS_ALLOWED = 0;
firewall.ACCESS_DENIED = 1;
firewall.ACCESS_LIMITED = 2;

// Define firewall objects

firewall.ip = {};
firewall.sid = {};
firewall.host = {};
firewall.url = {};
firewall.app = {};
firewall.srv = {};

// Register application in firewall

firewall.addApplication = (application) => {

  if (!impress.config || !impress.config.scale.firewall.enabled) {
    return;
  }

  application.on('clientConnect', (client) => {
    const cfg = impress.config.scale.firewall.limits;
    if (cfg.ip) firewall.ip.inc(client.ipInt);
    if (cfg.host) firewall.host.inc(client.host);
    if (cfg.url) firewall.url.inc(client.url);
    if (cfg.app) firewall.app.inc(application.name);
    if (cfg.srv) firewall.srv.inc(client.server.name);
  });

  application.on('clientSession', (client) => {
    const cfg = impress.config.scale.firewall.limits;
    if (cfg.sid) firewall.sid.inc(client.sid);
  });

  application.on('clientDisconnect', (client) => {
    const cfg = impress.config.scale.firewall.limits;
    if (cfg.ip) firewall.ip.dec(client.ipInt);
    if (cfg.sid && client.sid) firewall.sid.dec(client.sid);
    if (cfg.host) firewall.host.dec(client.host);
    if (cfg.url) firewall.url.dec(client.url);
    if (cfg.app) firewall.app.dec(application.name);
    if (cfg.srv) firewall.srv.dec(client.server.name);
  });

};

firewall.check = (
  client // Check deny and limit restrictions
) => {
  if (!impress.config.scale.firewall.enabled) {
    return firewall.ACCESS_ALLOWED;
  }

  const cfg = impress.config.scale.firewall.limits;
  let allowed = true;
  let limited = false;

  let key, limit;
  firewall.objects.map((obj) => {
    if (allowed && obj.denied) {
      key = obj.key(client);
      allowed = !obj.denied.includes(key);
    }
    if (allowed && !limited && obj.limit) {
      key = obj.key(client);
      limit = cfg[obj.name];
      if (limit) limited = obj.limit[key] > limit;
    }
  });

  let code;
  if (!allowed) code = firewall.ACCESS_DENIED;
  else if (limited) code = firewall.ACCESS_LIMITED;
  else code = firewall.ACCESS_ALLOWED;
  return code;
};

// Names of firewall objects
//
const OBJECT_NAMES = ['ip', 'sid', 'host', 'url', 'app', 'srv'];

// Array of firewall objects
//
firewall.objects = OBJECT_NAMES.map((objectName) => {
  const obj = firewall[objectName];
  obj.name = objectName;
  return obj;
});

firewall.ip.key = client => client.ipInt;
firewall.sid.key = client => client.sid;
firewall.host.key = client => client.host;
firewall.url.key = client => client.req.url;
firewall.app.key = client => client.application.name;
firewall.srv.key = client => client.server.name;

firewall.mixins = {};

firewall.mixins.deny = (
  // Mixin deny() method for firewall.ip, firewall.host, etc.
  item
) => {
  item.denied = [];

  item.deny = (key) => {
    if (!item.denied.includes(key)) item.denied.push(key);
  };
};

firewall.mixins.limit = (
  // Mixin inc/dec() methods for firewall.ip, firewall.host, etc.
  item
) => {
  item.limit = {};

  item.inc = (key) => {
    const limit = item.limit[key];
    if (limit) item.limit[key] = limit + 1;
    else item.limit[key] = 1;
  };

  item.dec = (key) => {
    const limit = item.limit[key];
    if (limit === 1) delete item.limit[key];
    else item.limit[key] = limit - 1;
  };
};

firewall.mx = (items, mixins) => (
  mixins.map(mixin => items.map(mixin))
);

firewall.mx([
  firewall.ip,
  firewall.sid,
  firewall.host
], [
  firewall.mixins.deny,
  firewall.mixins.limit
]);

firewall.mx([
  firewall.url,
  firewall.app,
  firewall.srv
], [
  firewall.mixins.limit
]);
