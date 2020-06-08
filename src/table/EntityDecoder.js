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

const { EdmType } = require('azure-storage').TableUtilities;

function decodeValue({ $, _ }) {
  switch ($) {
    case EdmType.BINARY:
      return JSON.parse(_);
    case EdmType.BOOLEAN:
      return _ === 'true';
    case EdmType.DATETIME:
      return Date.parse(_);
    case EdmType.STRING:
    default:
      return _;
  }
}

class EntityDecoder {
  static decode(entity) {
    return Object.entries(entity)
      .filter(([k]) => k !== '.metadata')
      .reduce((o, [k, v]) => (
        Object.defineProperty(o, k, {
          enumerable: true,
          value: decodeValue(v),
        })), {});
  }
}

module.exports = EntityDecoder;
