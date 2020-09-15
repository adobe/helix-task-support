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
      provider: {
        itemId: 'foo-bar',
      },
    });
    assert.strictEqual(change.path, '/foo');
    assert.strictEqual(change.uid, '1234');
    assert.strictEqual(change.type, 'added');
    assert.strictEqual(change.deleted, false);
    assert.deepEqual(change.provider, {
      itemId: 'foo-bar',
    });
  });

  it('Can create a new change instance with defaults', () => {
    const change = new Change({
      path: '/foo',
    });
    assert.strictEqual(change.path, '/foo');
    assert.strictEqual(change.uid, null);
    assert.strictEqual(change.type, 'modified');
    assert.strictEqual(change.deleted, false);
  });

  it('Can create a new delete change instance', () => {
    const change = new Change({
      path: '/foo',
      type: 'deleted',
    });
    assert.strictEqual(change.path, '/foo');
    assert.strictEqual(change.deleted, true);
  });

  it('Can create a change with no path', () => {
    const change = new Change({
      uid: '1234',
      type: 'deleted',
    });
    assert.strictEqual(change.path, undefined);
    assert.strictEqual(change.deleted, true);
    assert.strictEqual(change.uid, '1234');
  });

  it('Can create a change instance from params', () => {
    const change = Change.fromParams({ path: '/foo' });
    assert.strictEqual(change.path, '/foo');
    assert.strictEqual(change.uid, null);
  });

  it('Can create a change instance from observation params', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/foo/bar',
          uid: '1234',
          type: 'deleted',
        },
      },
    });
    assert.strictEqual(change.path, '/foo/bar');
    assert.strictEqual(change.uid, '1234');
    assert.strictEqual(change.deleted, true);
  });

  it('Can create a change instance from observation params with mount point', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/documents/bar',
          uid: '1234',
          type: 'deleted',
        },
        mountpoint: {
          root: '/documents',
          path: '/en',
        },
      },
    });
    assert.strictEqual(change.path, '/en/bar');
    assert.strictEqual(change.uid, '1234');
    assert.strictEqual(change.deleted, true);
  });

  it('Can create a change instance from observation params with mount point at root', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/documents/bar',
        },
        mountpoint: {
          root: '/',
          path: '/en',
        },
      },
    });
    assert.strictEqual(change.path, '/en/documents/bar');
  });

  it('Can create a change instance from observation params with mount path at root', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/documents/bar',
        },
        mountpoint: {
          root: '/documents/',
          path: '/',
        },
      },
    });
    assert.strictEqual(change.path, '/bar');
  });

  it('Can create a change instance from observation params with non matching mountpoint', () => {
    const change = Change.fromParams({
      observation: {
        change: {
          path: '/documents/bar',
        },
        mountpoint: {
          root: '/foo/',
          path: '/en',
        },
      },
    });
    assert.strictEqual(change.path, '/documents/bar');
  });
});
