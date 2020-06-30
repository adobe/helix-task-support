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

'use strict';

const { ServiceBusClient } = require('@azure/service-bus');

const triggerInvoke = require('../trigger/invoke.js');

async function deliver({
  params, coords, changes, mountpoint, resource, log,
}) {
  const {
    AZURE_SERVICE_BUS_CONN_STRING: connectionString,
  } = params;

  if (!connectionString) {
    throw new Error('AZURE_SERVICE_BUS_CONN_STRING missing.');
  }

  const { owner, repo, ref } = coords;
  const topicName = `${owner}/${repo}/${ref}`;

  const sbClient = ServiceBusClient.createFromConnectionString(connectionString);
  const topicClient = sbClient.createTopicClient(topicName);
  const sender = topicClient.createSender();

  try {
    const messages = changes.map((change) => ({
      body: {
        ...coords,
        observation: {
          type: 'onedrive',
          change,
          mountpoint: {
            path: mountpoint.path,
            root: mountpoint.root,
          },
          provider: {
            driveId: resource.split('/')[2],
          },
        },
      },
    }));
    await sender.sendBatch(messages);
    log.info(`Sent ${changes.length} change(s) to topic ${topicName}`);

    await triggerInvoke({ name: `${owner}--${repo}--${ref}`, log });
  } finally {
    await sbClient.close();
  }
}

module.exports = deliver;
