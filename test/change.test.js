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

/* eslint-env mocha */

'use strict';

const assert = require('assert');
const { Change } = require('../src/index.js');

describe('Change class tests', () => {
  it('Can create a new change instance', () => {
    const change = new Change({
      path: '/foo',
      uid: '1234',
      type: 'added',
    });
    assert.equal(change.path, '/foo');
    assert.equal(change.uid, '1234');
    assert.equal(change.type, 'added');
    assert.equal(change.deleted, false);
  });

  it('Can create a new change instance with defaults', () => {
    const change = new Change({
      path: '/foo',
    });
    assert.equal(change.path, '/foo');
    assert.equal(change.uid, null);
    assert.equal(change.type, 'modified');
    assert.equal(change.deleted, false);
  });

  it('Can create a new delete change instance', () => {
    const change = new Change({
      path: '/foo',
      type: 'deleted'
    });
    assert.equal(change.path, '/foo');
    assert.equal(change.deleted, true);
  });

  it('Can requires a path', () => {
    assert.throws(() => (new Change({})), new Error('path parameter missing.'));
  });

  it('Can create a change instance from params', () => {
    const change = Change.fromParams({ path: '/foo' });
    assert.equal(change.path, '/foo');
    assert.equal(change.uid, null);
  });

  it('Can create a change instance from observation params', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/foo/bar',
          uid: '1234',
          type: 'deleted'
        },
      }
    });
    assert.equal(change.path, '/foo/bar');
    assert.equal(change.uid, '1234');
    assert.equal(change.deleted, true);
  });

  it('Can create a change instance from observation params with mount point', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/documents/bar',
          uid: '1234',
          type: 'deleted'
        },
        mountpoint: {
          root: '/documents',
          path: '/en'
        }
      }
    });
    assert.equal(change.path, '/en/bar');
    assert.equal(change.uid, '1234');
    assert.equal(change.deleted, true);
  });

  it('Can create a change instance from observation params with mount point at root', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/documents/bar',
        },
        mountpoint: {
          root: '/',
          path: '/en'
        }
      }
    });
    assert.equal(change.path, '/en/documents/bar');
  });

  it('Can create a change instance from observation params with mount path at root', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/documents/bar',
        },
        mountpoint: {
          root: '/documents/',
          path: '/'
        }
      }
    });
    assert.equal(change.path, '/bar');
  });

  it('Can create a change instance from observation params with non matching mountpoint', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/documents/bar',
        },
        mountpoint: {
          root: '/foo/',
          path: '/en'
        }
      }
    });
    assert.equal(change.path, '/documents/bar');
  });
});
