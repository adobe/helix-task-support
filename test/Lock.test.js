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

const assert = require('assert');
const proxyquire = require('proxyquire');
const MockBlobService = require('./blob/BlobService.js');

let containerData = {};

/**
 * Inject mock service into our component.
 */
const Lock = proxyquire('../src/Lock.js', {
  'azure-storage': {
    createBlobService: () => new MockBlobService(containerData),
  },
});

describe('Lock validation tests', () => {
  it('Check required arguments', () => {
    assert.throws(() => new Lock({}), /missing/);
    assert.throws(() => new Lock({
      AZURE_STORAGE_CONNECTION_STRING: 'foo',
    }), /missing/);
  });
});

describe('Lock operation tests', () => {
  const params = {
    AZURE_STORAGE_CONNECTION_STRING: 'foo',
    AZURE_STORAGE_CONTAINER_NAME: 'bar',
  };

  beforeEach(() => {
    containerData = {};
  });

  it('Lock acquire and release', async () => {
    const lock = new Lock(params, console);
    const result = await lock.acquire();
    assert.equal(result, true);
    await lock.release();
  });

  it('Lock acquire twice must fail', async () => {
    const lock = new Lock(params, console);
    let result = await lock.acquire();
    assert.equal(result, true);
    result = await lock.acquire(1);
    assert.equal(result, false);
    await lock.release();
  });

  it('Lock tryAcquire twice must fail', async () => {
    const lock = new Lock(params, console);
    let result = await lock.tryAcquire();
    assert.equal(result, true);
    result = await lock.tryAcquire();
    assert.equal(result, false);
    await lock.release();
  });

  it('Lock init succeeds if the empty blob already exists', async () => {
    const e = new Error();
    e.code = 'BlobAlreadyExists';
    containerData = {
      bar: {
        error: e,
      },
    };
    const lock = new Lock(params, console);
    await assert.doesNotReject(async () => lock.tryAcquire());
  });

  it('Lock init rejects if creating the empty blob fails', async () => {
    const e = new Error();
    e.code = 'SomethingElseHappened';
    containerData = {
      bar: {
        error: e,
      },
    };
    const lock = new Lock(params, console);
    await assert.rejects(async () => lock.tryAcquire());
  });

  it('Lock tryAcquire rejects if some other error occurs', async () => {
    const e = new Error();
    e.code = 'SomethingElseHappened';
    containerData = {
      bar: {
        lock: {
          error: e,
        },
      },
    };
    const lock = new Lock(params, console);
    await assert.rejects(async () => lock.tryAcquire());
  });
});
