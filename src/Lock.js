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

const util = require('util');
const storage = require('azure-storage');

const BlobService = require('./blob/BlobService.js');

const sleep = util.promisify(setTimeout);

/**
 * Create a blob service that promisifies methods expecting a callback.
 *
 * @param {object} [opts] options
 * @param {string} [opts.AZURE_STORAGE_CONNECTION_STRING] Azure Storage Connection String
 * @param {string} [opts.AZURE_STORAGE_CONTAINER_NAME] Azure Storage Container name
 * @returns blob service
 */
function createBlobService(opts) {
  const {
    AZURE_STORAGE_CONNECTION_STRING: connectionString,
    AZURE_STORAGE_CONTAINER_NAME: containerName,
  } = opts;

  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING missing.');
  }
  if (!containerName) {
    throw new Error('AZURE_STORAGE_CONTAINER_NAME missing.');
  }
  return new BlobService(storage, connectionString, containerName);
}

/**
 * Provides a lock backed up by a text blob in a container.
 *
 * @param {object} [opts] options
 * @param {string} [opts.AZURE_STORAGE_CONNECTION_STRING] Azure Storage Connection String
 * @param {string} [opts.AZURE_STORAGE_CONTAINER_NAME] Azure Storage Container name
 * @param {string} [opts.name] Lock name, used for naming the blob
 * @param {object} log logger
 */
class Lock {
  constructor(opts, log) {
    this._blobSvc = createBlobService(opts);
    this._blob = opts.name || 'lock';

    this._log = log;
  }

  /**
   * If necessary, create an empty text blob that will be used to acquire a lease on.
   */
  async init() {
    if (this._initialized) {
      return;
    }
    const result = await this._blobSvc.doesBlobExist(this._blob);
    if (!result.exists) {
      try {
        // This access condition makes the call fail if the blob already exists
        const accessConditions = { EtagNonMatch: '*' };
        await this._blobSvc.createBlockBlobFromText(this._blob, '', { accessConditions });
      } catch (e) {
        if (e.code !== 'BlobAlreadyExists') {
          throw e;
        }
      }
    }
    this._initialized = true;
  }

  /**
   * Acquires a lock. Internally, repeatedly tries to acquire a lease on our
   * blob until it either succeeds or the timeout expires.
   *
   * @param {number} timeoutMillis timeout in milliseconds to wait for lock
   * @param {number} leaseDuration duration of lease in seconds
   * @returns true if lock is successfully acquired, otherwise false.
   */
  async acquire(timeoutMillis = 60000, leaseDuration = 60) {
    await this.init();

    const endTime = Date.now() + timeoutMillis;
    while (Date.now() < endTime) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.tryAcquire(leaseDuration);
      if (result) {
        return result;
      }
      sleep(1000);
    }
    return false;
  }

  /**
   * Try acquiring a lock. If lock is not available, return immediately.
   *
   * @param {number} leaseDuration duration of lease in seconds
   * @returns true if lock is successfully acquired, otherwise false.
   */
  async tryAcquire(leaseDuration = 60) {
    await this.init();

    try {
      const result = await this._blobSvc.acquireLease(this._blob, { leaseDuration });
      this._lease = result.id;
      return true;
    } catch (e) {
      if (e.code !== 'LeaseAlreadyPresent') {
        throw e;
      }
      return false;
    }
  }

  /**
   * Releases a lock previously acquired.
   *
   * @returns true if lock was previously acquired, otherwise false
   */
  async release() {
    const lease = this._lease;
    if (lease) {
      await this._blobSvc.releaseLease(this._blob, lease);
      this._lease = null;
    }
    return !!lease;
  }
}

module.exports = Lock;
