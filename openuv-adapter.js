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

const UV_LEVELS = {
  0: 'Low',
  3: 'Moderate',
  6: 'High',
  8: 'Very High',
  11: 'Extreme'
};

function getUVLevel(level) {
  const keys = Object.keys(UV_LEVELS);
  const matchingKeys = keys.filter((key) => key <= level);
  const key = Math.max.apply(null, matchingKeys);

  return UV_LEVELS[key];
}

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
      readOnly: true,
      multipleOf: 0.001
    });

    this.addProperty('uv_refresh_time', {
      type: 'string',
      title: 'UV refresh time',
      description: 'The last time the uv index changed',
      readOnly: true
    });

    this.addProperty('ozone', {
      type: 'number',
      unit: 'DU',
      title: 'Ozone',
      description: 'The ozone level',
      readOnly: true,
      multipleOf: 0.1
    });

    this.addProperty('ozone_refresh_time', {
      type: 'string',
      title: 'Ozone refresh time',
      description: 'The last time the ozone level changed',
      readOnly: true
    });

    this.addProperty('uv_max', {
      type: 'number',
      title: 'Max UV',
      description: 'The maximum UV level of the current day',
      readOnly: true,
      multipleOf: 0.001
    });

    this.addProperty('uv_level', {
      type: 'string',
      title: 'UV level',
      description: 'The current UV level',
      readOnly: true,
      enum: Object.values(UV_LEVELS)
    });

    this.addProperty('uv_level_max', {
      type: 'string',
      title: 'Max UV level',
      description: 'The maximum UV level of the current day',
      readOnly: true,
      enum: Object.values(UV_LEVELS)
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
      this.setValue('uv_refresh_time', this.getTime(json.result.uv_time));
      this.setValue('ozone', json.result.ozone);
      this.setValue('ozone_refresh_time', this.getTime(json.result.ozone_time));
      this.setValue('uv_max', json.result.uv_max);
      this.setValue('uv_level', getUVLevel(json.result.uv));
      this.setValue('uv_level_max', getUVLevel(json.result.uv_max));
    }
  }

  getTime(dateTime) {
    const date = new Date(dateTime);
    const hours = this.formatTime(date.getHours());
    const minutes = this.formatTime(date.getMinutes());

    return `${hours}:${minutes}`;
  }

  formatTime(time) {
    return time < 10 ? `0${time}` : `${time}`;
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
