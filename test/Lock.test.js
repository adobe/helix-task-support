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
const sinon = require('sinon');
const MockBlobService = require('./blob/BlobService.js');

/**
 * Container data.
 */
let containerData = {};

/**
 * Mock blob service instance.
 */
let blobService;

/**
 * Inject mock service into our component.
 */
const Lock = proxyquire('../src/Lock.js', {
  'azure-storage': {
    createBlobService: () => blobService,
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
    blobService = new MockBlobService(containerData);
  });

  it('Lock acquire and release', async () => {
    const lock = new Lock(params, console);
    assert.strictEqual(await lock.acquire(), true);
    assert.strictEqual(await lock.release(), true);
  });

  it('Lock acquire twice must fail', async () => {
    const lock = new Lock(params, console);
    let result = await lock.acquire();
    assert.strictEqual(result, true);
    result = await lock.acquire(1);
    assert.strictEqual(result, false);
    await lock.release();
  });

  it('Lock tryAcquire twice must fail', async () => {
    const lock = new Lock(params, console);
    let result = await lock.tryAcquire();
    assert.strictEqual(result, true);
    result = await lock.tryAcquire();
    assert.strictEqual(result, false);
    await lock.release();
  });

  it('createBlobFromText isn\'t called if blob already exists', async () => {
    const spy = sinon.spy(blobService, 'createBlockBlobFromText');
    sinon.stub(blobService, 'doesBlobExist').yields(null, { exists: true });

    const lock = new Lock(params, console);
    await lock.acquire();
    assert(spy.notCalled);
  });

  it('Lock init succeeds if creating the blob throws with BlobAlreadyExists', async () => {
    const e = new Error();
    e.code = 'BlobAlreadyExists';
    sinon.stub(blobService, 'createBlockBlobFromText').yields(e);

    const lock = new Lock(params, console);
    await assert.doesNotReject(async () => lock.tryAcquire());
  });

  it('Lock init rejects if creating the blob throws other error', async () => {
    sinon.stub(blobService, 'createBlockBlobFromText').yields(new Error('boo'));

    const lock = new Lock(params, console);
    await assert.rejects(async () => lock.tryAcquire());
  });

  it('Lock tryAcquire rejects if some other error occurs', async () => {
    sinon.stub(blobService, 'acquireLease').yields(new Error('boo'));

    const lock = new Lock(params, console);
    await assert.rejects(async () => lock.tryAcquire());
  });

  it('Lock release is no-op if acquire was never called', async () => {
    const lock = new Lock(params, console);
    assert.strictEqual(await lock.release(), false);
  });
});
