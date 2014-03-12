/**
 * Copyright 2013-2014 BigML
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

"use strict";

var BigML = require('./BigML');
var Resource = require('./Resource');
var constants = require('./constants');
var logger = require('./logger');
var utils = require('./utils');
var async = require('async');

function BatchPrediction(connection) {
  Resource.call(this, connection);
}

BatchPrediction.prototype = new Resource();

BatchPrediction.prototype.parent = Resource.prototype;

BatchPrediction.prototype.create = function (modelOrEnsemble,
                                             dataset, args, retry, cb) {
  /**
   * Creates a batch prediction and builds customized error and resource info
   *
   * Returns a BigML resource wrapped in an object that includes
   *   code: HTTP status code
   *   resource: The resource/id
   *   location: Remote location of the resource
   *   object: The resource itself
   *   error: An error code and message
   *
   */

  var self = this, options, resources,
    origins = ['ensemble', 'model'],
    message = 'Failed to create the batch prediction. First parameter must be' +
    ' a model or ensemble id.',
    resourceId,
    datasetId,
    createErrors = constants.HTTP_COMMON_ERRORS,
    reqOptions = {
      method: 'POST',
      resourceType: 'batchprediction',
      endpoint: '/'
    };
    createErrors.push(constants.HTTP_PAYMENT_REQUIRED);
    createErrors.push(constants.HTTP_FORBIDDEN);

  if (arguments.length > 0) {
    options = utils.optionalCUParams([].slice.call(arguments, 1), message);
    resourceId = utils.getResource(modelOrEnsemble);
    datasetId = utils.getResource(dataset);
    options.operation = 'create';
    options.args.dataset = datasetId.resource;
    if (origins.indexOf(resourceId.type) > -1) {
      options.args[resourceId.type] = resourceId.resource;
    } else {
      throw new Error(message);
    }
    options = utils.setRetries(options);
    options.type = reqOptions.resourceType;
    this.options = options;
  } else {
    options = this.options;
  }
  reqOptions.body = options.args;
  function sendRequest(error) {
    if (error) {
      logger.error("Origin resources could not be retrieved: " + error);
    } else {
      self.connection.request(reqOptions,
                              function processResponse(error, data, response) {
          var code = constants.HTTP_INTERNAL_SERVER_ERROR,
            result = utils.makeEmptyResult('resource',
                                           code,
                                           'The resource couldn\'t be created');
          return utils.requestResponse('resource', self,
                                       constants.HTTP_CREATED,
                                       createErrors,
                                       error, data, response, result,
                                       options.cb);
        });
    }
  }
  // The origin resource must be retrieved in a finished state before 
  // create starts. This is only done when create is called by the user, not
  // internally to retry creation.

  if (arguments.length > 0) {
    resources = [datasetId.resource, resourceId.resource];
    async.each(resources, function(resource, done) {
        new Resource(self.connection).get(resource, true, done);
        },
      sendRequest);
  } else {
    sendRequest(null);
  }
};

BatchPrediction.prototype.list = function (query, cb) {
  this.parent.list.call(this, 'batchprediction', query, cb);
};

BatchPrediction.prototype.download = function (resource, filename, cb) {
  /**
   * Downloads the batch prediction output file.
   *
   * @param {object|string} resource Batch prediction resource or id
   * @param {string} filename Name of the file to store the prediction output
   *                          in (optional)
   * @param {string} cb Callback where the response body is sent to (optional)
   *
   */
  var resourceId = utils.getResource(resource),
    reqOptions = {
      resourceType: resourceId.type,
      endpoint: '/' + resourceId.id,
    };
  if ((typeof cb) === 'undefined') {
    cb = utils.showResult;
  }
  return this.connection.download(reqOptions, filename, cb);
};

module.exports = BatchPrediction;