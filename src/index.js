'use strict';

const path = require('path');
const BaseAdapter = require('ghost-storage-base');
const { Storage } = require('@google-cloud/storage');

class GoogleCloudStorageAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);

    let storage;
    
    if (config.keyFilename) {
      storage = new Storage({
        keyFilename: config.keyFilename
      });
    } else {
      storage = new Storage();
    }
    
    this.bucket = storage.bucket(config.bucket);
    this.assetDomain = `${config.bucket}.storage.googleapis.com`;
    if (config.cdn) {
      this.assetDomain = config.cdn;
    }
  }

  exists(fileName, targetDir) {
    return this.bucket.file(path.join(targetDir, fileName))
      .exists()
      .then(function(data) {
        return data[0]
      })
      .catch((error) => Promise.reject(error));
  }

  save(image) {
    const targetDir = this.getTargetDir();
    let targetFilename;
    return this.getUniqueFileName(image, targetDir)
      .then(fileName => {
        targetFilename = fileName;

        const options = {
          destination: fileName,
          metadata: {
            cacheControl: `public, max-age=${3600 * 24 * 365}`
          },
          public: true
        };
        return this.bucket.upload(image.path, options);
      })
      .then(data => {
        return `https://${this.assetDomain}/${targetFilename}`;
      })
      .catch(error => Promise.reject(error));
  }

  serve() {
    // File paths are absolute URLs, no need to serve
    return function customServe(req, res, next) {
      next();
    };
  }

  delete(fileName) {
    return this.bucket.file(fileName).delete();
  }

  read(options = {}) {
    const readStream = this.bucket.file(options.path).createReadStream()
    let contents = null;
    return new Promise(function(resolve, reject) {
      readStream.on('error', function(err) {
        return reject(err);
      });
      readStream.on('data', function(data) {
        if (contents) {
          contents = data;
        } else {
          contents = Buffer.concat([contents, data]);
        }
      });
      readStream.on('end', function() {
        return resolve(content);
      });
    });
  }
}

module.exports = GoogleCloudStorageAdapter;