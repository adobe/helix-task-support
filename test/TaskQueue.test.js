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
const MockTableService = require('./table/TableService.js');

const sleep = util.promisify(setTimeout);

let tableData = {};

/**
 * Inject mock service into our component.
 */
const TaskQueue = proxyquire('../src/TaskQueue.js', {
  'azure-storage': {
    createTableService: () => new MockTableService(tableData),
  },
});

describe('TaskQueue validation tests', () => {
  it('Check required arguments', () => {
    assert.throws(() => new TaskQueue({}), /missing/);
    assert.throws(() => new TaskQueue({
      AZURE_STORAGE_CONNECTION_STRING: 'foo',
    }), /missing/);
  });
  it('Use default partition key', async () => {
    const params = {
      AZURE_STORAGE_CONNECTION_STRING: 'foo',
      AZURE_STORAGE_TABLE_NAME: 'bar',
    };
    const queue = new TaskQueue(params, console);
    const uuid = await queue.insert({});
    const task = await queue.get(uuid);
    assert.equal(task.PartitionKey, '');
  });
});

/**
 * Create a random partition key to check other tasks are not interfered with.
 *
 * @param {object} params parameters
 * @param {string} partitionKey partition key
 */
function withPartitionKey(params, partitionKey) {
  return {
    ...params,
    AZURE_STORAGE_PARTITION_KEY: partitionKey || Math.random().toString(16).substr(2),
  };
}

describe('TaskQueue operation tests', () => {
  const params = {
    AZURE_STORAGE_CONNECTION_STRING: 'foo',
    AZURE_STORAGE_TABLE_NAME: 'bar',
  };

  beforeEach(() => {
    tableData = {};
  });

  it('Create task queue', async () => {
    const queue = new TaskQueue(withPartitionKey(params), console);
    const s = queue.toString();
    assert.notEqual(s, null);
  });

  it('Insert object into task queue', async () => {
    const queue = new TaskQueue(withPartitionKey(params), console);
    const uuid = await queue.insert({ foo: 'bar', is: true, when: Date.now() });
    const task = await queue.get(uuid);
    assert.equal(task.status, 'not started');
  });

  it('Fetching non-existing task', async () => {
    const queue = new TaskQueue(withPartitionKey(params), console);
    const task = await queue.get('dummy');
    assert.equal(task, null);
  });

  it('Check done tasks', async () => {
    const queue = new TaskQueue(withPartitionKey(params), console);
    const uuid = await queue.insert({ foo: 'bar' });
    let done = await queue.done();
    assert.equal(done.length, 0);
    await queue.update(uuid, { status: 'done' });
    done = await queue.done();
    assert.equal(done.length, 1);
    assert.equal(done[0].RowKey, uuid);
  });

  it('Check error task', async () => {
    const queue = new TaskQueue(withPartitionKey(params), console);
    const uuid = await queue.insert({ foo: 'bar' });
    let error = await queue.error();
    assert.equal(error, null);
    await queue.update(uuid, { status: 'error', error: new Error() });
    error = await queue.error();
    assert.equal(error.RowKey, uuid);
  });

  it('Check dead task', async () => {
    const queue = new TaskQueue(withPartitionKey(params), console);
    const uuid = await queue.insert({ foo: 'bar' });
    let dead = await queue.dead(1000);
    assert.equal(dead, null);
    await sleep(10);
    dead = await queue.dead(9);
    assert.notEqual(dead, null);
    assert.equal(dead.RowKey, uuid);
  });

  it('Check wrongly typed uuid is detected', async () => {
    const queue = new TaskQueue(withPartitionKey(params), console);
    await assert.rejects(async () => queue.get(1), /should be a string/);
  });

  it('Use same task queue with 2 partitions simultaneously', async () => {
    const queue1 = new TaskQueue(withPartitionKey(params), console);
    await queue1.insert({});
    const queue2 = new TaskQueue(withPartitionKey(params), console);
    await queue2.insert({});
    assert.equal(await queue1.tasks(), 1);
    assert.equal(await queue2.size(), 2);
  });

  it('Task queue should return empty list when acquire fails', async () => {
    const failsAcquireLock = {
      acquire: () => false,
      release: () => {},
    };
    const queue = new TaskQueue({ lock: failsAcquireLock, ...params }, console);
    const uuid = await queue.insert({ foo: 'bar' });
    await queue.update(uuid, { status: 'done' });
    const done = await queue.done();
    assert.equal(done.length, 0);
  });
});
