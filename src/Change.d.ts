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

/**
 * Declares a mountpoint as defined in an fstab.yaml
 */
export declare interface Mountpoint {
  /**
   * The root of the external source
   */
  root: string;

  /**
   * The mount path.
   */
  path: string;
}

/**
 * Change event sent via observation.
 */
export declare interface ChangeEvent {
  /**
   * uid of the change
   */
  uid: string;

  /**
   * path of the changed document
   */
  path: string;

  /**
   * type of change: 'added', 'modified', 'deleted'
   */
  type: string;

  /**
   * timestamp of event
   */
  time: string;

  /**
   * provider specific data.
   */
  provider: any;
}

/**
 * Observation event
 */
export declare interface ObservationEvent {
  /**
   * Change that occurred.
   */
  change: ChangeEvent;

  /**
   * Corresponding mountpoint
   */
  mountpoint: Mountpoint;

  /**
   * provider specific data.
   */
  provider: any;
}

/**
 * Parameters for Change.fromParams() options.
 */
export declare interface ChangeFromParamsOptions {
  observation?: ObservationEvent;
  path?: string;
}

/**
 * Change class.
 */
export declare class Change {
  static fromParams(params: ChangeFromParamsOptions): Change;

  constructor(opts: ChangeEvent);

  path: string;

  uid: string;

  deleted: boolean;

  type: string;

  provider: any;
}
