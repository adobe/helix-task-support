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
const TableService = require('./TableService.js');

const sleep = util.promisify(setTimeout);

/**
 * Our table backing up the task queue.
 */
let tableStub;

/**
 * Proxy our real OW action and its requirements.
 *
 * @param {Function} invoke OW action to invoke
 */
const TaskQueue = proxyquire('../src/TaskQueue.js', {
  './table/TableService.js': class {
    constructor() {
      return tableStub;
    }
  },
});

describe('TaskQueue Tests', () => {
  const params = {
    AZURE_STORAGE_CONNECTION_STRING: 'foo',
    AZURE_STORAGE_TABLE_NAME: 'bar',
  };

  beforeEach(() => {
    tableStub = new TableService();
  });

  it('Create task queue', async () => {
    const queue = new TaskQueue(params, console);
    const size = await queue.size();
    assert.equal(size, 0);
  });

  it('Insert item into task queue', async () => {
    const queue = new TaskQueue(params, console);
    const uuid = await queue.insert({ foo: 'bar' });
    const size = await queue.size();
    assert.equal(size, 1);
    const task = await queue.get(uuid);
    assert.equal(task.status, 'not started');
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
