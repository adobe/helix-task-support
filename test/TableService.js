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

/**
 * Mock up Table Service that uses in-memory tables.
 */
class TableService {
  constructor(data = [], log = console) {
    this._data = data;
    this._log = log;
  }

  createTableIfNotExists() {
    // our table already exists
  }

  deleteEntity(entityDescriptor) {
    const { PartitionKey: { _: partitionKey }, RowKey: { _: rowKey } } = entityDescriptor;
    const index = this._data.findIndex(
      (item) => item.PartitionKey._ === partitionKey && item.RowKey._ === rowKey,
    );
    if (index === -1) {
      throw new Error(`Entity not found: ${partitionKey}/${rowKey}`);
    }
    this._data.splice(index, 1);
  }

  executeBatch(batch) {
    batch.operations.forEach((op) => {
      if (op.type === 'DELETE') {
        this.deleteEntity(op.entity);
      }
    });
  }

  insertEntity(entityDescriptor) {
    const entity = { Timestamp: Date.now() * 1000, ...entityDescriptor };
    this._data.push(entity);
  }

  mergeEntity(entityDescriptor) {
    const { PartitionKey: { _: partitionKey }, RowKey: { _: rowKey } } = entityDescriptor;
    const entity = this.retrieveEntity(partitionKey, rowKey);
    if (!entity) {
      throw new Error(`Entity not found: ${partitionKey}/${rowKey}`);
    }
    Object.assign(entity, entityDescriptor, { Timestamp: Date.now() * 1000 });
  }

  queryEntities(query) {
    let entries = this._data;
    if (query._fields.length) {
      entries = entries.map((entry) => pick(entry, ...query._fields));
    }
    return { entries };
  }

  retrieveEntity(partitionKey, rowKey) {
    const entity = this._data.find(
      (item) => item.PartitionKey._ === partitionKey && item.RowKey._ === rowKey,
    );
    if (!entity) {
      throw new Error(`Entity not found: ${partitionKey}/${rowKey}`);
    }
    return entity;
  }

  get log() {
    return this._log;
  }
}

module.exports = TableService;
