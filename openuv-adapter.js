/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const fetch = require('node-fetch');

const {
  Adapter,
  Device,
  Property
} = require('gateway-addon');

class OpenUVDevice extends Device {
  constructor(adapter, manifest) {
    super(adapter, OpenUVDevice.name);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this.name = manifest.display_name;
    this.description = manifest.description;
    this.apiKey = manifest.moziot.config.apiKey;
    this.latitude = manifest.moziot.config.latitude;
    this.longitude = manifest.moziot.config.longitude;

    this.addProperty('uv', {
      type: 'number',
      title: 'UV',
      description: 'The current UV index',
      readOnly: true
    });

    this.addProperty('uv_time', {
      type: 'string',
      title: 'UV time',
      description: 'The time of the current UV index',
      readOnly: true
    });

    this.addProperty('ozone', {
      type: 'number',
      title: 'Ozone',
      description: 'The ozone level',
      readOnly: true
    });

    this.addProperty('ozone_time', {
      type: 'string',
      title: 'Ozone time',
      description: 'The time of the ozone level',
      readOnly: true
    });

    if (!this.apiKey) {
      console.warn('No apiKey set');
    }

    if (!this.latitude) {
      console.warn('No latitude set');
    }

    if (!this.longitude) {
      console.warn('No longitude set');
    }
  }

  addProperty(id, description) {
    const property = new Property(this, id, description);

    this.properties.set(id, property);
  }

  startPolling(interval) {
    this.poll();
    this.timer = setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    if (this.apiKey && this.latitude && this.longitude) {
      // eslint-disable-next-line max-len
      const result = await fetch(`https://api.openuv.io/api/v1/uv?lat=${this.latitude}&lng=${this.longitude}`, {
        method: 'get',
        headers: {
          'content-type': 'application/json',
          'x-access-token': this.apiKey
        }
      });

      const json = await result.json();

      this.setValue('uv', json.result.uv);
      this.setValue('uv_time', json.result.uv_time);
      this.setValue('ozone', json.result.ozone);
      this.setValue('ozone_time', json.result.ozone_time);
    }
  }

  setValue(id, value) {
    const property = this.properties.get(id);
    property.setCachedValue(value);
    this.notifyPropertyChanged(property);
  }
}

class OpenUVAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, OpenUVAdapter.name, manifest.name);
    addonManager.addAdapter(this);
    const device = new OpenUVDevice(this, manifest);
    this.handleDeviceAdded(device);
    device.startPolling(30 * 60);
  }
}

module.exports = OpenUVAdapter;
