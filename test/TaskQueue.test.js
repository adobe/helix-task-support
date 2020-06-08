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

/* eslint-env mocha */

'use strict';

const util = require('util');
const assert = require('assert');
const proxyquire = require('proxyquire');
const TableService = require('../src/table/TableService.js');
const StorageTableService = require('./table/TableService.js');

const sleep = util.promisify(setTimeout);

/**
 * Constructor arguments.
 */
let constructorArgs;

/**
 * Proxy our real OW action and its requirements.
 *
 * @param {Function} invoke OW action to invoke
 */
const TaskQueue = proxyquire('../src/TaskQueue.js', {
  'azure-storage': {
    createTableService: () => new StorageTableService(),
  },
  './table/TableService.js': class {
    constructor(storage, connectionString, tableName) {
      constructorArgs = { storage, connectionString, tableName };
      return new TableService(storage, connectionString, tableName);
    }
  },
});

describe('TaskQueue validation tests', () => {
  it('Check required arugments', () => {
    assert.throws(() => new TaskQueue({}), /missing/);
    assert.throws(() => new TaskQueue({
      AZURE_STORAGE_CONNECTION_STRING: 'foo',
    }), /missing/);
  });
  it('Check table name wins over subscription name', () => {
    assert.notEqual(null, new TaskQueue({
      AZURE_STORAGE_CONNECTION_STRING: 'foo',
      AZURE_STORAGE_TABLE_NAME: 'bar',
      AZURE_SERVICE_BUS_SUBSCRIPTION_NAME: 'baz',
    }));
    assert.equal(constructorArgs.tableName, 'bar');
  });
  it('Check simple subscription name', () => {
    assert.notEqual(null, new TaskQueue({
      AZURE_STORAGE_CONNECTION_STRING: 'foo',
      AZURE_SERVICE_BUS_SUBSCRIPTION_NAME: 'bar',
    }));
    assert.equal(constructorArgs.tableName, 'bar');
  });
  it('Check service type subscription name', () => {
    assert.notEqual(null, new TaskQueue({
      AZURE_STORAGE_CONNECTION_STRING: 'foo',
      AZURE_SERVICE_BUS_SUBSCRIPTION_NAME: 'namespace--package--service',
    }));
    assert.equal(constructorArgs.tableName, 'namespacepackageservice');
  });
  it('Check version gets ignored in service type subscription name', () => {
    assert.notEqual(null, new TaskQueue({
      AZURE_STORAGE_CONNECTION_STRING: 'foo',
      AZURE_SERVICE_BUS_SUBSCRIPTION_NAME: 'namespace--package--service--latest',
    }));
    assert.equal(constructorArgs.tableName, 'namespacepackageservice');
  });
});

describe('TaskQueue operation tests', () => {
  const params = {
    AZURE_STORAGE_CONNECTION_STRING: 'foo',
    AZURE_STORAGE_TABLE_NAME: 'bar',
  };

  it('Create task queue', async () => {
    const queue = new TaskQueue(params, console);
    const size = await queue.size();
    assert.equal(size, 0);
  });

  it('Insert boolean into task queue', async () => {
    const queue = new TaskQueue(params, console);
    const uuid = await queue.insert(true);
    const size = await queue.size();
    assert.equal(size, 1);
    const task = await queue.get(uuid);
    assert.equal(task.status, 'not started');
  });
  it('Insert object into task queue', async () => {
    const queue = new TaskQueue(params, console);
    const uuid = await queue.insert({ foo: 'bar', is: true, when: Date.now() });
    const size = await queue.size();
    assert.equal(size, 1);
    const task = await queue.get(uuid);
    assert.equal(task.status, 'not started');
  });

  it('Fetching non-existing task', async () => {
    const queue = new TaskQueue(params, console);
    const task = await queue.get('dummy');
    assert.equal(task, null);
  });

  it('Check done tasks', async () => {
    const queue = new TaskQueue(params, console);
    const uuid = await queue.insert({ foo: 'bar' });
    await queue.update(uuid, { status: 'done' });
    const done = await queue.done();
    assert.equal(done.length, 1);
    assert.equal(done[0].RowKey, uuid);
  });

  it('Check error task', async () => {
    const queue = new TaskQueue(params, console);
    const uuid = await queue.insert({ foo: 'bar' });
    await queue.update(uuid, { status: 'error', error: new Error() });
    const error = await queue.error();
    assert.equal(error.RowKey, uuid);
  });

  it('Check dead task', async () => {
    const queue = new TaskQueue(params, console);
    const uuid = await queue.insert({ foo: 'bar' });
    await sleep(1000);
    const dead = await queue.dead(1);
    assert.equal(dead.RowKey, uuid);
  });
});
