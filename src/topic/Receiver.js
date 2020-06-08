/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-disable no-console */

'use strict';

const { ServiceBusClient, ReceiveMode } = require('@azure/service-bus');

/**
 * Receive messages from a ServiceBus Topic Subscription.
 */
class Receiver {
  /**
   * Create a new instance.
   *
   * @param {object} params connection parameters
   * @param {object} log logger
   */
  constructor(params, log) {
    const {
      AZURE_SERVICE_BUS_CONN_STRING: connectionString,
      AZURE_SERVICE_BUS_TOPIC_NAME: topicName,
      AZURE_SERVICE_BUS_SUBSCRIPTION_NAME: subscriptionName,
    } = params;

    if (!connectionString) {
      throw new Error('AZURE_SERVICE_BUS_CONN_STRING missing.');
    }
    if (!topicName) {
      throw new Error('AZURE_SERVICE_BUS_TOPIC_NAME missing.');
    }
    if (!subscriptionName) {
      throw new Error('AZURE_SERVICE_BUS_SUBSCRIPTION_NAME missing.');
    }
    this._connectionString = connectionString;
    this._topicName = topicName;
    this._subscriptionName = subscriptionName;
    this._log = log;
  }

  async _init() {
    if (this._receiver) {
      return;
    }
    this._sbClient = ServiceBusClient.createFromConnectionString(this._connectionString);
    this._subscriptionClient = this._sbClient.createSubscriptionClient(
      this._topicName, this._subscriptionName,
    );
    this._receiver = this._subscriptionClient.createReceiver(ReceiveMode.receiveAndDelete);
  }

  /**
   * Receive changes.
   *
   * @param {number} numChanges number of changes to fetch, default: 1
   * @param {number} maxWaitSecs number of seconds to wait, default: 3
   *
   * @returns {Array} array of changes, might be empty
   */
  async receive(numChanges = 1, maxWaitSecs = 3) {
    const { _log: log } = this;
    await this._init();

    const messages = await this._receiver.receiveMessages(numChanges, maxWaitSecs);
    log.debug(`Subscription ${this._subscriptionName} received ${messages.length} change(s)`);
    return messages.map((message) => message.body);
  }

  /**
   * Close this receiver, freeing up resources.
   */
  async close() {
    if (this._receiver) {
      await this._subscriptionClient.close();
      await this._sbClient.close();
    }
  }
}

module.exports = Receiver;
