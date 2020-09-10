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

const { v4: generateUUID } = require('uuid');
const storage = require('azure-storage');

const TableService = require('./table/TableService.js');
const EntityDecoder = require('./table/EntityDecoder.js');
const EntityEncoder = require('./table/EntityEncoder.js');

function createTableService(opts) {
  const {
    AZURE_STORAGE_CONNECTION_STRING: connectionString,
    AZURE_STORAGE_TABLE_NAME: tableName,
  } = opts;

  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING missing.');
  }
  if (!tableName) {
    throw new Error('AZURE_STORAGE_TABLE_NAME missing.');
  }
  return new TableService(storage, connectionString, tableName);
}

const NULL_LOCK = {
  acquire: () => true,
  release: () => {},
};

/**
 * Provides a queue for tasks.
 */
class TaskQueue {
  constructor(opts, log) {
    this._tableSvc = createTableService(opts);
    this._partitionKey = opts.AZURE_STORAGE_PARTITION_KEY || '';
    this._lock = opts.lock || NULL_LOCK;

    this._log = log;
    [this._started, this._done, this._dead, this._error] = [0, 0, 0, 0];
  }

  async _init() {
    await this._tableSvc.createTableIfNotExists();
  }

  /**
   * Return the size of the task queue.
   *
   * @returns size of task queue
   */
  async size() {
    await this._init();

    const query = new storage.TableQuery().select('metadata');
    const result = await this._tableSvc.queryEntities(query, null);
    return result.entries.length;
  }

  /**
   * Return the number of tasks in the task queue for our partition key.
   *
   * @returns number of tasks
   */
  async tasks() {
    await this._init();

    const query = new storage.TableQuery()
      .select('metadata')
      .where('PartitionKey == ?', this._partitionKey);

    const result = await this._tableSvc.queryEntities(query, null);
    return result.entries.length;
  }

  /**
   * Inserts a new task into the queue.
   *
   * @param {object} data task data
   * @returns {string} uuid of new task
   */
  async insert(data) {
    await this._init();

    const uuid = generateUUID();
    const entGen = storage.TableUtilities.entityGenerator;
    const entity = {
      PartitionKey: entGen.String(this._partitionKey),
      RowKey: entGen.String(`${uuid}`),
      status: entGen.String('not started'),
    };
    EntityEncoder.encode(entity, data);
    await this._tableSvc.insertEntity(entity);
    this._started += 1;

    return uuid;
  }

  /**
   * Retrieve task.
   *
   * @param {string} uuid task UUID
   * @returns {object} task or null
   */
  async get(uuid) {
    await this._init();

    try {
      const result = await this._tableSvc.retrieveEntity(this._partitionKey, uuid);
      return EntityDecoder.decode(result);
    } catch (e) {
      if (e.code === storage.Constants.StorageErrorCodeStrings.RESOURCE_NOT_FOUND) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Update task stats.
   *
   * @param {string} uuid task UUID
   * @param {object} stats task stats
   */
  async update(uuid, stats) {
    await this._init();

    const entGen = storage.TableUtilities.entityGenerator;
    const entity = {
      PartitionKey: entGen.String(this._partitionKey),
      RowKey: entGen.String(uuid),
    };
    EntityEncoder.encode(entity, stats);
    await this._tableSvc.mergeEntity(entity);
  }

  /**
   * Return at most one task that has been idle for a certain amount of milliseconds.
   *
   * @param {number} duration duration in milliseconds
   * @returns {object} dead task or null
   */
  async dead(duration) {
    await this._init();

    const timestamp = new Date(Date.now() - duration);
    const [dead] = await this._purge('Timestamp < ?date?', timestamp, 1);
    if (dead) {
      this._dead += 1;
    }
    return dead;
  }

  /**
   * Returns all tasks that are done.
   *
   * @returns {Array} array of done tasks
   */
  async done() {
    await this._init();

    const done = await this._purge('status == ?', 'done');
    if (done.length) {
      this._done += done.length;
    }
    return done;
  }

  /**
   * Return at most one task that is in error state.
   *
   * @param {number} duration duration in seconds
   * @returns {object} error task or null
   */
  async error() {
    await this._init();

    const [error] = await this._purge('status == ?', 'error', 1);
    if (error) {
      this._error += 1;
    }
    return error;
  }

  /**
   * Purge a certain amount of tasks with a given status from our queue
   * and return their contents.
   *
   * @param {string} condition string condition
   * @param {(string|number)} arg argument for condition
   * @param {number} limit number of items to return, -1 to return all
   * @returns {Array} tasks purged
   */
  async _purge(condition, arg, limit = -1) {
    try {
      if (!await this._lock.acquire()) {
        return [];
      }
      let query = new storage.TableQuery()
        .where('PartitionKey == ?', this._partitionKey)
        .and(condition, arg);
      if (limit !== -1) {
        query = query.top(limit);
      }
      const result = await this._tableSvc.queryEntities(query, null);
      const entities = result.entries.map((e) => EntityDecoder.decode(e));

      const batch = new storage.TableBatch();
      entities.forEach((entity) => {
        const entityDescriptor = {
          PartitionKey: { _: entity.PartitionKey },
          RowKey: { _: entity.RowKey },
        };
        batch.deleteEntity(entityDescriptor);
      });
      if (batch.size() > 0) {
        await this._tableSvc.executeBatch(batch);
      }
      return entities;
    } finally {
      await this._lock.release();
    }
  }

  /**
   * Return a string representation of the queue.
   *
   * @returns string representation
   */
  toString() {
    return `(started:${this._started}, done:${this._done}, error:${this._error}, dead:${this._dead})`;
  }
}

module.exports = TaskQueue;
