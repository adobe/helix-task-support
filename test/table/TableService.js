/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */

'use strict';

const pick = require('lodash.pick');
const {
  Constants: { StorageErrorCodeStrings },
  TableUtilities: { entityGenerator: entGen },
} = require('azure-storage');

/**
 * Mock up Table Service that uses in-memory tables.
 */
class TableService {
  constructor(data = {}, log = console) {
    this._data = data;
    this._log = log;
  }

  createTableIfNotExists(table, callback) {
    let created = false;
    if (!this._data[table]) {
      this._data[table] = [];
      created = true;
    }
    callback(null, created);
  }

  deleteEntity(table, entityDescriptor, callback) {
    const data = this._data[table];
    const { PartitionKey: { _: partitionKey }, RowKey: { _: rowKey } } = entityDescriptor;
    const index = data.findIndex(
      (item) => item.PartitionKey._ === partitionKey && item.RowKey._ === rowKey,
    );
    if (index === -1) {
      callback(new Error(`Entity not found: ${partitionKey}/${rowKey}`));
    }
    data.splice(index, 1);
    callback();
  }

  executeBatch(table, batch, callback) {
    batch.operations.forEach((op) => {
      if (op.type === 'DELETE') {
        this.deleteEntity(table, op.entity, (error) => {
          if (error) {
            callback(error);
          }
        });
      }
    });
    callback();
  }

  insertEntity(table, entityDescriptor, callback) {
    const data = this._data[table];
    const entity = { Timestamp: entGen.DateTime(Date.now() * 1000), ...entityDescriptor };
    data.push(entity);
    callback(null, entity);
  }

  mergeEntity(table, entityDescriptor, callback) {
    const { PartitionKey: { _: partitionKey }, RowKey: { _: rowKey } } = entityDescriptor;
    this.retrieveEntity(table, partitionKey, rowKey, (error, result) => {
      if (error) {
        callback(error);
      }
      const entity = result;
      Object.assign(entity, entityDescriptor, { Timestamp: entGen.DateTime(Date.now() * 1000) });
      callback(null, entity);
    });
  }

  queryEntities(table, query, _, callback) {
    const data = this._data[table];
    let entries = data;
    if (query._fields.length) {
      entries = entries.map((entry) => pick(entry, ...query._fields));
    }
    callback(null, { entries });
  }

  retrieveEntity(table, partitionKey, rowKey, callback) {
    const data = this._data[table];
    const entity = data.find(
      (item) => item.PartitionKey._ === partitionKey && item.RowKey._ === rowKey,
    );
    if (!entity) {
      const e = new Error(`Entity not found: ${partitionKey}/${rowKey}`);
      e.code = StorageErrorCodeStrings.RESOURCE_NOT_FOUND;
      callback(e);
    }
    callback(null, entity);
  }

  get log() {
    return this._log;
  }
}

module.exports = TableService;
