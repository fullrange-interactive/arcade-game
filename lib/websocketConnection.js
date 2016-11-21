/**
 * Creates and maintains a websocket connection.
 */
"use strict";

var SECRET = "UEh9R5PmuAUeieEqz5pJdZupXKw7AimAvjcVsky7BeKguUtVmYGIsQ5BIYoP";

var Class = function() {
  this.initialize && this.initialize.apply(this, arguments);
};

Class.extend = function(childPrototype) { // defining a static method 'extend'

  var parent = this;
  var child = function() { // the child constructor is a call to its parent's
    return parent.apply(this, arguments);
  };

  child.extend = parent.extend; // adding the extend method to the child class

  var Surrogate = function() {}; // surrogate "trick" as seen previously

  Surrogate.prototype = parent.prototype;

  child.prototype = new Surrogate();

  for (var key in childPrototype) {
    child.prototype[key] = childPrototype[key];
  }

  child.prototype.$super = parent;

  return child; // returning the child class
};

function clone(obj) {
  if (null == obj || "object" != typeof obj) return obj;
  var copy = obj.constructor();
  for (var attr in obj) {
    if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
  }
  return copy;
}

var WebsocketConnection = Class.extend({
  initialize: function(serverHost, serverPort, callbacksByType, options) {

    this.status = 'disconnected';

    this.lastActivity = 0;

    /* Mendatory options */
    this.serverHost = serverHost;
    this.serverPort = serverPort;

    console.log("[clientConnection] Init with " + this.serverHost + "," + this.serverPort);

    this.callbacksByType = {};

    for (var callbackId in callbacksByType) {
      console.log("[clientConnection] Registering callback " + callbackId);
      this.setCallback(callbackId, callbacksByType[callbackId]);
    }

    /* Options with default values */
    this.pingIntervalSeconds = options.hasOwnProperty('pingIntervalSeconds') ? options.pingIntervalSeconds : 10;
    this.timeoutSeconds = options.hasOwnProperty('timeoutSeconds') ? options.timeoutSeconds : 30;
    this.autoReconnect = options.hasOwnProperty('autoReconnect') ? options.autoReconnect : true;
    this.autoConnect = options.hasOwnProperty('autoConnect') ? options.autoConnect : true;

    if (this.autoConnect)
      this.connect();

    this.checkInterval = setInterval(this._doCheck.bind(this), this.pingIntervalSeconds * 1000);
  },

  sendMessage: function(message) {
    message.secret = SECRET;
    if (this.status === 'connected') {
      this.client.send(JSON.stringify(message));
    }
  },
  
  /**
   * Connects the websocket to the endpoint. 
   * 
   * When this function is called, we assume there is no interval running.
   */
  connect: function() {

    if (this.status !== 'disconnected')
      return false;

    this.status = 'connecting';

    console.log("[clientConnection] Connecting to ws://" + this.serverHost + ':' + this.serverPort + '/');

    this.client = new WebSocket('ws://' + this.serverHost + ':' + this.serverPort + '/', 'echo-protocol');

    this.client.onerror = this._onError.bind(this);
    this.client.onclose = this._onClose.bind(this);
    this.client.onmessage = this._onMessage.bind(this);
    this.client.onopen = this._onOpen.bind(this);

    return true;
  },

  disconnect: function() {

    if (this.status !== 'connected')
      return false;

    this.status = 'disconnecting';

    this.client.close();

    return true;
  },

  setCallback: function(name, callback) {

    this.callbacksByType[name] = callback;
  },

  removeCallback: function(name) {

    if (this.callbacksByType.hasOwnProperty(name))
      delete this.callbacksByType[name];
  },

  _closingCodeToReason: function(code) {

    var reason;

    if (code === 1000)
      reason = "Normal closure, meaning that the purpose for which the connection was established has been fulfilled.";
    else if (code === 1001)
      reason = "An endpoint is \"going away\", such as a server going down or a browser having navigated away from a page.";
    else if (code === 1002)
      reason = "An endpoint is terminating the connection due to a protocol error";
    else if (code === 1003)
      reason = "An endpoint is terminating the connection because it has received a type of data it cannot accept (e.g., an endpoint that understands only text data MAY send this if it receives a binary message).";
    else if (code === 1004)
      reason = "Reserved. The specific meaning might be defined in the future.";
    else if (code === 1005)
      reason = "No status code was actually present.";
    else if (code === 1006)
      reason = "The connection was closed abnormally, e.g., without sending or receiving a Close control frame";
    else if (code === 1007)
      reason = "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message (e.g., non-UTF-8 [http://tools.ietf.org/html/rfc3629] data within a text message).";
    else if (code === 1008)
      reason = "An endpoint is terminating the connection because it has received a message that \"violates its policy\". This reason is given either if there is no other sutible reason, or if there is a need to hide specific details about the policy.";
    else if (code === 1009)
      reason = "An endpoint is terminating the connection because it has received a message that is too big for it to process.";
    else if (code === 1010) // Note that this status code is not used by the server, because it can fail the WebSocket handshake instead.
      reason = "An endpoint (client) is terminating the connection because it has expected the server to negotiate one or more extension, but the server didn't return them in the response message of the WebSocket handshake. <br /> Specifically, the extensions that are needed are: " + event.reason;
    else if (code === 1011)
      reason = "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.";
    else if (code === 1015)
      reason = "The connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).";
    else
      reason = "Unknown reason";

    return reason;
  },

  _doCallback: function(name, arg) {

    if (this.callbacksByType.hasOwnProperty(name))
      this.callbacksByType[name](this, arg);
  },

  _onError: function(error) {

    this.status = 'disconnecting';

    console.log('[clientConnection][ERROR] Cannot connect');

    this.client.close();

    this._doCallback('error', error);
  },

  _onClose: function(event) {

    if (this.checkInterval !== null)
      this.status = 'disconnected-waiting';
    else
      this.status = 'disconnected';

    console.log('[clientConnection] closed. Reason: ' + this._closingCodeToReason(event.code));

    this._doCallback('close', event.code);
  },

  _onMessage: function(message) {

    message.utf8Data = message.data;

    var parsedMessage = false;

    this.lastActivity = (new Date()).getTime();

    try {
      parsedMessage = JSON.parse(message.utf8Data);

    } catch (e) {
      console.error('[clientConnection][ERROR] error parsing message ' + message.utf8Data);
      return;
    }

    this._doCallback('message', parsedMessage);
  },

  _onOpen: function() {

    this.status = 'connected';

    this._doCallback('open');
  },

  _doCheck: function() {

    /* If we loose the connection, try to close the connection and reconnect again */

    switch (this.status) {
      case 'disconnected-waiting':
      case 'disconnected':

        this.status = 'disconnected';

        if (this.autoReconnect === true)
          this.connect();
        break;
      case 'connected':
        this.client.send(JSON.stringify({
          type: 'ping',
          secret: SECRET
        }), function() {});
        /* Check last activity in every case */
        /* falls through */
      default:
        if (this.lastActivity + this.timeoutSeconds * 1000 < (new Date()).getTime()) {
          this.status = 'disconnecting';
          this.client.close();
        }
    }
    this._doCallback('check', this.status);
  },
  getConnection: function() {
    return this.client;
  }
});
