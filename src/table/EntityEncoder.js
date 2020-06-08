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

const storage = require('azure-storage');

function encodeValue(v) {
  const entGen = storage.TableUtilities.entityGenerator;
  if (v instanceof Object) {
    return entGen.Binary(Buffer.from(JSON.stringify(v)));
  } else {
    return entGen.String(v);
  }
}

class EntityEncoder {
  static encode(entity, obj) {
    return Object.entries(obj).forEach(([k, v]) => {
      Object.defineProperty(entity, k, {
        enumerable: true,
        value: encodeValue(v),
      });
    });
  }
}

module.exports = EntityEncoder;
