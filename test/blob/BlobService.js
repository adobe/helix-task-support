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

/**
 * Mock up Blob Service that uses in-memory containers.
 */
class BlobService {
  constructor(data = {}, log = console) {
    this._data = data;
    this._log = log;
  }

  _getOrCreateContainer(container) {
    if (!this._data[container]) {
      this._data[container] = [];
    }
    return this._data[container];
  }

  doesBlobExist(container, blob, opts, callback) {
    const cb = callback || opts;

    const data = this._getOrCreateContainer(container);
    cb(null, { exists: !!data[blob] });
  }

  createBlockBlobFromText(container, blob, text, opts, callback) {
    const cb = callback || opts;

    const data = this._getOrCreateContainer(container);
    if (data.error) {
      cb(data.error);
    }
    data[blob] = { text, lease: null };
    cb(null);
  }

  acquireLease(container, blob, opts, callback) {
    const cb = callback || opts;

    const data = this._getOrCreateContainer(container);
    const obj = data[blob];
    if (obj.error) {
      cb(obj.error);
    }
    if (obj.lease) {
      const e = new Error();
      e.code = 'LeaseAlreadyPresent';
      cb(e);
    }
    const lease = Math.random().toString(16).substr(2);
    obj.lease = lease;
    cb(null, lease);
  }

  releaseLease(container, blob, lease, opts, callback) {
    const cb = callback || opts;

    const data = this._getOrCreateContainer(container);
    const obj = data[blob];
    obj.lease = null;

    cb(null, lease);
  }

  get log() {
    return this._log;
  }
}

module.exports = BlobService;
