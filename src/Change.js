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

const posixPath = require('path').posix;

class Change {
  constructor({
    path, uid = null, type = 'modified', provider,
  }) {
    this._path = path;
    this._uid = uid;
    this._type = type;
    this._provider = provider;
  }

  /**
   * Return a change object with path, uid and type
   *
   * @param {object} params Runtime parameters
   * @returns {Change} change object
   */
  static fromParams(params) {
    const { observation } = params;
    if (observation) {
      const { change, mountpoint } = observation;
      const opts = {
        uid: change.uid, path: change.path, type: change.type, provider: change.provider,
      };
      if (mountpoint && opts.path) {
        let { root } = mountpoint;
        if (!root.endsWith('/')) {
          root += '/';
        }
        if (opts.path.startsWith(root)) {
          opts.path = posixPath.resolve(mountpoint.path, opts.path.substring(root.length));
        }
      }
      return new Change(opts);
    }
    return new Change({ path: params.path });
  }

  get path() {
    return this._path;
  }

  get uid() {
    return this._uid;
  }

  get type() {
    return this._type;
  }

  get deleted() {
    return this._type === 'deleted';
  }

  get provider() {
    return this._provider;
  }
}

module.exports = Change;
