/**
 * @license
 * Copyright The Closure Library Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview An abstract superclass for message channels that handles the
 * repetitive details of registering and dispatching to services. This is more
 * useful for full-fledged channels than for decorators, since decorators
 * generally delegate service registering anyway.
 */


goog.provide('goog.messaging.AbstractChannel');

goog.require('goog.Disposable');
goog.require('goog.json');
goog.require('goog.log');
goog.require('goog.messaging.MessageChannel');  // interface



/**
 * Creates an abstract message channel.
 *
 * @constructor
 * @extends {goog.Disposable}
 * @implements {goog.messaging.MessageChannel}
 */
goog.messaging.AbstractChannel = function() {
  'use strict';
  goog.messaging.AbstractChannel.base(this, 'constructor');

  /**
   * The services registered for this channel.
   * @type {Object<string, {callback: function((string|!Object)),
                             objectPayload: boolean}>}
   * @private
   */
  this.services_ = {};
};
goog.inherits(goog.messaging.AbstractChannel, goog.Disposable);


/**
 * The default service to be run when no other services match.
 *
 * @type {?function(string, (string|!Object))}
 * @private
 */
goog.messaging.AbstractChannel.prototype.defaultService_;


/**
 * Logger for this class.
 * @type {goog.log.Logger}
 * @protected
 */
goog.messaging.AbstractChannel.prototype.logger =
    goog.log.getLogger('goog.messaging.AbstractChannel');


/**
 * Immediately calls opt_connectCb if given, and is otherwise a no-op. If
 * subclasses have configuration that needs to happen before the channel is
 * connected, they should override this and {@link #isConnected}.
 * @override
 */
goog.messaging.AbstractChannel.prototype.connect = function(opt_connectCb) {
  'use strict';
  if (opt_connectCb) {
    opt_connectCb();
  }
};


/**
 * Always returns true. If subclasses have configuration that needs to happen
 * before the channel is connected, they should override this and
 * {@link #connect}.
 * @override
 */
goog.messaging.AbstractChannel.prototype.isConnected = function() {
  'use strict';
  return true;
};


/** @override */
goog.messaging.AbstractChannel.prototype.registerService = function(
    serviceName, callback, opt_objectPayload) {
  'use strict';
  this.services_[serviceName] = {
    callback: callback,
    objectPayload: !!opt_objectPayload
  };
};


/** @override */
goog.messaging.AbstractChannel.prototype.registerDefaultService = function(
    callback) {
  'use strict';
  this.defaultService_ = callback;
};


/** @override */
goog.messaging.AbstractChannel.prototype.send = goog.abstractMethod;


/**
 * Delivers a message to the appropriate service. This is meant to be called by
 * subclasses when they receive messages.
 *
 * This method takes into account both explicitly-registered and default
 * services, as well as making sure that JSON payloads are decoded when
 * necessary. If the subclass is capable of passing objects as payloads, those
 * objects can be passed in to this method directly. Otherwise, the (potentially
 * JSON-encoded) strings should be passed in.
 *
 * @param {string} serviceName The name of the service receiving the message.
 * @param {string|!Object} payload The contents of the message.
 * @protected
 */
goog.messaging.AbstractChannel.prototype.deliver = function(
    serviceName, payload) {
  'use strict';
  var service = this.getService(serviceName, payload);
  if (!service) {
    return;
  }

  var decodedPayload =
      this.decodePayload(serviceName, payload, service.objectPayload);
  if (decodedPayload != null) {
    service.callback(decodedPayload);
  }
};


/**
 * Find the service object for a given service name. If there's no service
 * explicitly registered, but there is a default service, a service object is
 * constructed for it.
 *
 * @param {string} serviceName The name of the service receiving the message.
 * @param {string|!Object} payload The contents of the message.
 * @return {?{callback: function((string|!Object)), objectPayload: boolean}} The
 *     service object for the given service, or null if none was found.
 * @protected
 */
goog.messaging.AbstractChannel.prototype.getService = function(
    serviceName, payload) {
  'use strict';
  var service = this.services_[serviceName];
  if (service) {
    return service;
  } else if (this.defaultService_) {
    var callback = goog.partial(this.defaultService_, serviceName);
    var objectPayload = goog.isObject(payload);
    return {callback: callback, objectPayload: objectPayload};
  }

  goog.log.warning(this.logger, 'Unknown service name "' + serviceName + '"');
  return null;
};


/**
 * Converts the message payload into the format expected by the registered
 * service (either JSON or string).
 *
 * @param {string} serviceName The name of the service receiving the message.
 * @param {string|!Object} payload The contents of the message.
 * @param {boolean} objectPayload Whether the service expects an object or a
 *     plain string.
 * @return {string|Object} The payload in the format expected by the service, or
 *     null if something went wrong.
 * @protected
 */
goog.messaging.AbstractChannel.prototype.decodePayload = function(
    serviceName, payload, objectPayload) {
  'use strict';
  if (objectPayload && typeof payload === 'string') {
    try {
      return /** @type {!Object} */ (JSON.parse(payload));
    } catch (err) {
      goog.log.warning(
          this.logger, 'Expected JSON payload for ' + serviceName + ', was "' +
              payload + '"');
      return null;
    }
  } else if (!objectPayload && typeof payload !== 'string') {
    return goog.json.serialize(payload);
  }
  return payload;
};


/** @override */
goog.messaging.AbstractChannel.prototype.disposeInternal = function() {
  'use strict';
  goog.messaging.AbstractChannel.base(this, 'disposeInternal');
  delete this.services_;
  delete this.defaultService_;
};
